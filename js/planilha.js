// planilha.js — lê a aba "Funcionários" do "Modelo de Importação Sakuma" (.xlsx)
// dentro do próprio navegador, sem biblioteca nenhuma: um .xlsx é um ZIP com
// arquivos XML, e o Chrome já sabe descompactar (DecompressionStream) e ler XML
// (DOMParser). Assim não entra mais nada na pasta vendor.

/* ---------------- ZIP ---------------- */
async function inflar(bruto, metodo) {
  if (metodo === 0) return bruto;                       // guardado sem compressão
  const fluxo = new Blob([bruto]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

function abrirZip(buffer) {
  const dv = new DataView(buffer), u8 = new Uint8Array(buffer), td = new TextDecoder();
  let fim = -1;
  for (let i = buffer.byteLength - 22; i >= 0 && i > buffer.byteLength - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error('Este arquivo não parece uma planilha .xlsx.');
  const qtd = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const itens = new Map();
  for (let i = 0; i < qtd; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const compTam = dv.getUint32(p + 20, true);
    const nomeTam = dv.getUint16(p + 28, true);
    const extraTam = dv.getUint16(p + 30, true);
    const comTam = dv.getUint16(p + 32, true);
    const desloc = dv.getUint32(p + 42, true);
    itens.set(td.decode(u8.subarray(p + 46, p + 46 + nomeTam)), { metodo, compTam, desloc });
    p += 46 + nomeTam + extraTam + comTam;
  }
  return { dv, u8, itens };
}

async function texto(zip, caminho) {
  const it = zip.itens.get(caminho.replace(/^\//, ''));
  if (!it) return null;
  const h = it.desloc;
  const ini = h + 30 + zip.dv.getUint16(h + 26, true) + zip.dv.getUint16(h + 28, true);
  const dados = await inflar(zip.u8.subarray(ini, ini + it.compTam), it.metodo);
  return new TextDecoder().decode(dados);
}

/* ---------------- planilha ---------------- */
const xml = t => new DOMParser().parseFromString(t, 'application/xml');
const atributo = (el, local) => {
  for (const a of el.attributes) if (a.name === local || a.name.endsWith(':' + local)) return a.value;
  return null;
};
const colunaDe = ref => {
  let n = 0;
  for (const c of (ref.match(/^[A-Z]+/) || [''])[0]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

export const semAcento = s => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim().toUpperCase();

/** Lê uma aba pelo nome e devolve uma matriz de linhas. */
export async function lerAba(arquivo, nomeAba) {
  const zip = abrirZip(await arquivo.arrayBuffer());
  const livro = xml(await texto(zip, 'xl/workbook.xml'));
  const relacoes = xml(await texto(zip, 'xl/_rels/workbook.xml.rels'));

  const aba = [...livro.getElementsByTagName('sheet')]
    .find(s => semAcento(s.getAttribute('name')) === semAcento(nomeAba));
  if (!aba) throw new Error(`A planilha não tem a aba "${nomeAba}".`);
  const rid = atributo(aba, 'id');
  const rel = [...relacoes.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid);
  const alvo = (rel.getAttribute('Target') || '').replace(/^\//, '').replace(/^xl\//, '');

  // textos compartilhados
  const ssTexto = await texto(zip, 'xl/sharedStrings.xml');
  const compart = ssTexto
    ? [...xml(ssTexto).getElementsByTagName('si')]
        .map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join(''))
    : [];

  const folha = xml(await texto(zip, 'xl/' + alvo));
  const linhas = [];
  for (const tr of folha.getElementsByTagName('row')) {
    const n = parseInt(tr.getAttribute('r'), 10) - 1;
    const linha = [];
    for (const c of tr.getElementsByTagName('c')) {
      const tipo = c.getAttribute('t');
      let valor = null;
      if (tipo === 'inlineStr') {
        valor = [...c.getElementsByTagName('t')].map(t => t.textContent).join('');
      } else {
        const v = c.getElementsByTagName('v')[0];
        if (v) {
          const cru = v.textContent;
          if (tipo === 's') valor = compart[+cru] ?? '';
          else if (tipo === 'b') valor = cru === '1';
          else if (tipo === 'str' || tipo === 'e') valor = cru;
          else valor = +cru;
        }
      }
      linha[colunaDe(c.getAttribute('r') || '')] = valor;
    }
    linhas[n] = linha;
  }
  return linhas;
}

/* ---------------- datas ---------------- */
// O Excel guarda data como número de dias desde 30/12/1899.
function comoData(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const so = v => String(v == null ? '' : v).trim();
const maiusculo = v => so(v).replace(/\s+/g, ' ').toUpperCase();
const soDigitos = v => so(v).replace(/\D/g, '');
const cpfBonito = v => {
  const d = soDigitos(v);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : so(v);
};
const telefoneBonito = v => {
  const d = soDigitos(v).replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return so(v);
};

/* ---------------- aba Funcionários ---------------- */
// cada campo do app e o começo do título da coluna na planilha
const COLUNAS = [
  ['nome', 'NOME COMPLETO'],
  ['apelido', 'APELIDO'],
  ['cpf', 'CPF'],
  ['nascimento', 'DATA DE NASCIMENTO'],
  ['telefone', 'TELEFONE PRINCIPAL'],
  ['cadastro', 'MATRICULA'],
  ['admissao', 'DATA DE ADMISSAO'],
  ['empregador', 'EMPREGADOR'],
  ['fazenda', 'FAZENDA'],
  ['setor', 'SETOR'],
  ['cargo', 'FUNCAO'],
  ['tam_camisa', 'TAM. CAMISA'],
  ['tam_calcado', 'N DA BOTA'],
  ['situacao', 'SITUACAO'],
  ['observacao', 'OBSERVACAO'],
];

/**
 * Lê a aba "Funcionários" e devolve as pessoas já no formato do app.
 * Linhas sem nome e a linha de EXEMPLO do modelo são descartadas.
 */
export async function lerFuncionarios(arquivo) {
  const linhas = await lerAba(arquivo, 'Funcionários');

  let cabecalho = -1;
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    if ((linhas[i] || []).some(c => semAcento(c).startsWith('NOME COMPLETO'))) { cabecalho = i; break; }
  }
  if (cabecalho < 0) throw new Error('Não achei a linha de títulos ("Nome completo") na aba Funcionários.');

  const titulos = (linhas[cabecalho] || []).map(semAcento);
  const onde = {};
  for (const [campo, inicio] of COLUNAS) {
    const i = titulos.findIndex(t => t && t.startsWith(inicio));
    if (i >= 0) onde[campo] = i;
  }
  if (onde.nome == null) throw new Error('A aba Funcionários não tem a coluna "Nome completo".');

  const pega = (l, campo) => (onde[campo] == null ? null : l[onde[campo]]);
  const gente = [];
  for (let i = cabecalho + 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (!l) continue;
    const nome = so(pega(l, 'nome'));
    if (!nome) continue;
    if (/EXEMPLO/i.test(so(pega(l, 'observacao')))) continue;      // linha de exemplo do modelo
    if (soDigitos(pega(l, 'cpf')) === '12345678901') continue;

    const situacao = semAcento(pega(l, 'situacao'));
    gente.push({
      linha: i + 1,
      nome: maiusculo(nome),
      apelido: so(pega(l, 'apelido')),
      cpf: cpfBonito(pega(l, 'cpf')),
      nascimento: comoData(pega(l, 'nascimento')),
      telefone: telefoneBonito(pega(l, 'telefone')),
      cadastro: so(pega(l, 'cadastro')).replace(/\.0$/, ''),
      admissao: comoData(pega(l, 'admissao')),
      empregador: maiusculo(pega(l, 'empregador')),
      fazenda: maiusculo(pega(l, 'fazenda')),
      setor: maiusculo(pega(l, 'setor')),
      cargo: maiusculo(pega(l, 'cargo')),
      tam_camisa: so(pega(l, 'tam_camisa')),
      tam_calcado: so(pega(l, 'tam_calcado')).replace(/\.0$/, ''),
      situacao: situacao === 'DESLIGADO' ? 'INATIVO' : 'ATIVO',
    });
  }
  return gente;
}

/* ---------------- comparação com o cadastro ---------------- */
// Campos que a planilha preenche quando estão vazios no app. A situação é
// exceção: ela sempre vale a da planilha (foi assim que ele pediu, para o
// desligado virar inativo sozinho).
export const CAMPOS = ['apelido', 'cpf', 'nascimento', 'telefone', 'cadastro',
  'admissao', 'empregador', 'fazenda', 'setor', 'cargo', 'tam_camisa', 'tam_calcado'];

const vazio = v => v == null || String(v).trim() === '';

/** Acha no cadastro quem é a mesma pessoa: CPF, depois matrícula, depois nome. */
function casar(p, cadastrados) {
  const cpf = soDigitos(p.cpf);
  if (cpf.length === 11) {
    const f = cadastrados.find(x => soDigitos(x.cpf) === cpf);
    if (f) return { f, por: 'CPF' };
  }
  if (p.cadastro) {
    const f = cadastrados.find(x => so(x.cadastro) && so(x.cadastro) === p.cadastro);
    if (f) return { f, por: 'matrícula' };
  }
  const nome = semAcento(p.nome);
  const f = cadastrados.find(x => semAcento(x.nome) === nome);
  return f ? { f, por: 'nome' } : null;
}

/**
 * Separa a planilha em novos, completar e sem mudança, sem gravar nada.
 * @returns {{novos:Array, completar:Array, iguais:Array}}
 */
export function comparar(daPlanilha, cadastrados) {
  const novos = [], completar = [], iguais = [];
  const usados = new Set();

  for (const p of daPlanilha) {
    const achado = casar(p, cadastrados.filter(x => !usados.has(x.id)));
    if (!achado) { novos.push(p); continue; }
    usados.add(achado.f.id);

    const mudancas = [];
    for (const campo of CAMPOS) {
      if (!vazio(p[campo]) && vazio(achado.f[campo])) mudancas.push(campo);
    }
    const trocaSituacao = p.situacao !== (achado.f.situacao || 'ATIVO');
    if (mudancas.length || trocaSituacao) {
      completar.push({ planilha: p, atual: achado.f, por: achado.por, campos: mudancas, trocaSituacao });
    } else {
      iguais.push({ planilha: p, atual: achado.f, por: achado.por });
    }
  }
  return { novos, completar, iguais };
}

/** Monta o registro final de quem já existe, mexendo só no que estava vazio. */
export function aplicarEm(atual, planilha, campos, trocaSituacao) {
  const novo = { ...atual };
  for (const campo of campos) novo[campo] = planilha[campo];
  if (trocaSituacao) novo.situacao = planilha.situacao;
  return novo;
}
