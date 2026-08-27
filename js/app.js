// app.js — telas, eventos e ligação com o armazenamento
import * as db from './store.js';
import { estado, modeloAtual } from './store.js';
import { montarFicha, linhaVazia, MESES, TRACO } from './ficha.js';
import { SEED_MODELO } from './seed.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const marcados = new Set();     // ids de funcionários selecionados
const rascunhos = new Map();    // chave -> {linhas:[], id}
let editandoFunc = null;
let editandoEpi = null;

/* =============== telas =============== */
function mostrar(qual) {
  $('telaLogin').hidden = qual !== 'login';
  $('app').hidden = qual !== 'app';
}

function abrirAba(nome) {
  document.querySelectorAll('.aba').forEach(b =>
    b.setAttribute('aria-selected', String(b.dataset.tela === nome)));
  $('telaFichas').hidden = nome !== 'fichas';
  $('telaFuncionarios').hidden = nome !== 'funcionarios';
  $('telaEpis').hidden = nome !== 'epis';
  $('telaModelo').hidden = nome !== 'modelo';
  if (nome === 'funcionarios') desenharFuncionarios();
  if (nome === 'epis') desenharEpis();
  if (nome === 'modelo') preencherModelo();
}

/* =============== login =============== */
$('formLogin').addEventListener('submit', async ev => {
  ev.preventDefault();
  const erro = $('erroLogin'); erro.hidden = true;
  const botao = $('btnEntrar'); botao.disabled = true; botao.textContent = 'Entrando...';
  try {
    await db.entrar($('logEmail').value.trim(), $('logSenha').value);
    mostrar('app');
    await carregarTudo();
  } catch (e) {
    erro.textContent = traduzirErro(e);
    erro.hidden = false;
  } finally {
    botao.disabled = false; botao.textContent = 'Entrar';
  }
});

$('btnSair').addEventListener('click', async () => {
  await db.sair();
  marcados.clear(); rascunhos.clear();
  mostrar('login');
});

function traduzirErro(e) {
  const m = String(e?.message || e || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Confirme no painel do Supabase.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o Supabase. Verifique a internet ou a URL do projeto.';
  if (/relation .* does not exist/i.test(m)) return 'As tabelas ainda não existem. Rode o SQL do arquivo supabase.sql no SQL Editor.';
  return m || 'Não foi possível concluir.';
}

/* =============== carga =============== */
async function carregarTudo() {
  const aviso = $('avisoGlobal');
  try {
    await db.sincronizar();
    aviso.hidden = true;
  } catch (e) {
    aviso.textContent = 'Usando os dados salvos neste aparelho. ' + traduzirErro(e);
    aviso.hidden = false;
  }
  preencherControles();
  desenharSelecao();
  abrirAba('fichas');
}

function preencherControles() {
  const m = modeloAtual();
  if (!$('selMes').options.length) {
    MESES.forEach((nome, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = nome[0].toUpperCase() + nome.slice(1);
      $('selMes').appendChild(o);
    });
    const hoje = new Date();
    $('selMes').value = hoje.getMonth();
    $('selAno').value = hoje.getFullYear();
  }
  if (!$('selLinhas').value) $('selLinhas').value = m.linhas_padrao || 20;

  const emps = [...new Set(estado.funcionarios.map(f => f.empregador).filter(Boolean))].sort();
  $('fEmp').innerHTML = '<option value="">Todos</option>' +
    emps.map(e => `<option>${esc(e)}</option>`).join('');
  $('lista-empregadores').innerHTML =
    [...new Set([...(m.empregadores || []), ...emps])].map(e => `<option value="${esc(e)}">`).join('');
  const cargos = [...new Set([...(m.cargos || []), ...estado.funcionarios.map(f => f.cargo).filter(Boolean)])].sort();
  $('lista-cargos').innerHTML = cargos.map(c => `<option value="${esc(c)}">`).join('');
  $('lista-epis').innerHTML = estado.epis.filter(e => e.ativo !== false)
    .map(e => `<option value="${esc(e.descricao)}">${esc(e.ca ? 'C.A ' + e.ca : '')}</option>`).join('');
}

/* =============== aba FICHAS =============== */
function visiveis() {
  const q = $('busca').value.trim().toLowerCase();
  const s = $('fSit').value, e = $('fEmp').value;
  return estado.funcionarios.filter(f =>
    (!q || f.nome.toLowerCase().includes(q)) &&
    (!s || f.situacao === s) &&
    (!e || f.empregador === e));
}

function desenharSelecao() {
  const vs = visiveis(), box = $('listaSel');
  box.innerHTML = vs.length ? vs.map(f => `
    <label class="item" for="s_${f.id}">
      <input type="checkbox" id="s_${f.id}" data-id="${f.id}" ${marcados.has(f.id) ? 'checked' : ''}>
      <span>
        <span class="nome">${esc(f.nome)}</span><br>
        <span class="sub">${esc(f.cargo || '—')} · ${esc(f.empregador || '—')}${f.cadastro ? ' · nº ' + esc(f.cadastro) : ''}</span>
      </span>
      <span class="tag ${f.situacao === 'ATIVO' ? 'ativo' : 'inativo'}">${esc(f.situacao || '—')}</span>
    </label>`).join('')
    : '<div class="vazio">Nenhum funcionário encontrado.</div>';

  box.querySelectorAll('input[type=checkbox]').forEach(cb =>
    cb.addEventListener('change', () => {
      cb.checked ? marcados.add(cb.dataset.id) : marcados.delete(cb.dataset.id);
      atualizarFichas();
    }));
  atualizarFichas();
}

const chaveFicha = (id, mes, ano) => `${id}|${mes}|${ano}`;

function linhasDe(func, mes, ano, n) {
  const ch = chaveFicha(func.id, mes, ano);
  if (!rascunhos.has(ch)) {
    const salva = estado.fichas.find(f =>
      f.funcionario_id === func.id && f.mes === mes && f.ano === ano);
    rascunhos.set(ch, {
      id: salva?.id || db.novoId(),
      linhas: Array.isArray(salva?.linhas) ? salva.linhas.map(l => ({ ...linhaVazia(), ...l })) : [],
    });
  }
  const r = rascunhos.get(ch);
  while (r.linhas.length < n) r.linhas.push(linhaVazia());
  return { chave: ch, rascunho: r, linhas: r.linhas.slice(0, n) };
}

function atualizarFichas() {
  const n = marcados.size;
  $('cnt').textContent = n;
  ['bImprimir', 'bSalvarFichas', 'bLimparFichas'].forEach(id => { $(id).disabled = n === 0; });

  const mes = +$('selMes').value, ano = +$('selAno').value || new Date().getFullYear();
  const qtd = Math.max(1, Math.min(40, parseInt($('selLinhas').value) || 20));
  const modelo = modeloAtual();
  const sel = estado.funcionarios.filter(f => marcados.has(f.id));

  $('saida').innerHTML = sel.map(f => {
    const { chave, linhas } = linhasDe(f, mes, ano, qtd);
    return montarFicha(f, modelo, { mes, ano, linhas, chave });
  }).join('');
}

// digitação dentro das fichas
$('saida').addEventListener('input', ev => {
  const alvo = ev.target;
  if (!alvo.classList.contains('cx')) return;
  const ficha = alvo.closest('.ficha');
  const r = rascunhos.get(ficha.dataset.chave);
  if (!r) return;
  const i = +alvo.dataset.linha, campo = alvo.dataset.campo;
  while (r.linhas.length <= i) r.linhas.push(linhaVazia());
  r.linhas[i][campo] = alvo.value;
  alvo.closest('.cw').classList.toggle('preenchida', alvo.value !== '');

  // ao escolher um EPI do catálogo, completa o C.A da mesma linha
  if (campo === 'descricao') {
    const epi = estado.epis.find(e => e.descricao.toLowerCase() === alvo.value.trim().toLowerCase());
    if (epi && epi.ca) {
      const campoCa = ficha.querySelector(`.cx[data-linha="${i}"][data-campo="ca"]`);
      if (campoCa && !campoCa.value) {
        campoCa.value = epi.ca;
        r.linhas[i].ca = epi.ca;
        campoCa.closest('.cw').classList.add('preenchida');
      }
    }
  }
});

$('bSalvarFichas').addEventListener('click', async ev => {
  const botao = ev.currentTarget;
  botao.disabled = true; botao.textContent = 'Salvando...';
  const mes = +$('selMes').value, ano = +$('selAno').value;
  const usadas = new Set();
  for (const f of estado.funcionarios.filter(x => marcados.has(x.id))) {
    const ch = chaveFicha(f.id, mes, ano);
    const r = rascunhos.get(ch);
    if (!r) continue;
    const linhas = r.linhas.filter(l => Object.values(l).some(v => String(v || '').trim()));
    usadas.add(ch);
    await db.salvarFicha({
      id: r.id, funcionario_id: f.id, mes, ano,
      setor: f.setor || modeloAtual().setor_padrao || 'CAMPO', linhas,
    });
  }
  botao.textContent = usadas.size ? 'Salvo' : 'Salvar preenchimento';
  setTimeout(() => { botao.textContent = 'Salvar preenchimento'; botao.disabled = false; }, 1600);
});

$('bLimparFichas').addEventListener('click', () => {
  if (!confirm('Limpar as linhas preenchidas das fichas visíveis?')) return;
  const mes = +$('selMes').value, ano = +$('selAno').value;
  estado.funcionarios.filter(f => marcados.has(f.id))
    .forEach(f => rascunhos.delete(chaveFicha(f.id, mes, ano)));
  atualizarFichas();
});

['busca', 'fSit', 'fEmp'].forEach(id => $(id).addEventListener('input', desenharSelecao));
['selMes', 'selAno', 'selLinhas'].forEach(id => $(id).addEventListener('input', atualizarFichas));
$('bTodos').addEventListener('click', () => { visiveis().forEach(f => marcados.add(f.id)); desenharSelecao(); });
$('bNenhum').addEventListener('click', () => { marcados.clear(); desenharSelecao(); });
$('bImprimir').addEventListener('click', () => window.print());
$('zoom').addEventListener('input', () => {
  const z = $('zoom').value;
  $('zoomV').textContent = z + '%';
  $('saida').style.transform = `scale(${z / 100})`;
  $('saida').style.transformOrigin = 'top center';
});

/* =============== aba FUNCIONÁRIOS =============== */
function desenharFuncionarios() {
  const q = $('buscaFunc').value.trim().toLowerCase();
  const s = $('fSitFunc').value;
  const lista = estado.funcionarios.filter(f =>
    (!q || [f.nome, f.cargo, f.cadastro, f.empregador].some(v => String(v || '').toLowerCase().includes(q))) &&
    (!s || f.situacao === s));
  $('cntFunc').textContent = estado.funcionarios.length;
  $('listaFunc').innerHTML = lista.length ? lista.map(f => `
    <div class="item" data-id="${f.id}" style="grid-template-columns:1fr auto auto">
      <span>
        <span class="nome">${esc(f.nome)}</span><br>
        <span class="sub">${esc(f.cargo || '—')} · ${esc(f.empregador || '—')}${f.cadastro ? ' · nº ' + esc(f.cadastro) : ''}${f.admissao ? ' · desde ' + esc(dataBr(f.admissao)) : ''}</span>
      </span>
      <span class="tag ${f.situacao === 'ATIVO' ? 'ativo' : 'inativo'}">${esc(f.situacao || '—')}</span>
      <span class="acoes"><button class="btn mini" data-editar="${f.id}">Editar</button></span>
    </div>`).join('')
    : '<div class="vazio">Nenhum funcionário encontrado.</div>';

  $('listaFunc').querySelectorAll('[data-editar]').forEach(b =>
    b.addEventListener('click', () => abrirFuncionario(b.dataset.editar)));
}

const dataBr = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
};

function abrirFuncionario(id) {
  const f = id ? estado.funcionarios.find(x => x.id === id) : null;
  editandoFunc = f ? { ...f } : { id: db.novoId(), situacao: 'ATIVO', setor: modeloAtual().setor_padrao || 'CAMPO' };
  $('tituloFunc').textContent = f ? 'Editar funcionário' : 'Novo funcionário';
  $('fuNome').value = editandoFunc.nome || '';
  $('fuCadastro').value = editandoFunc.cadastro || '';
  $('fuAdmissao').value = (editandoFunc.admissao || '').slice(0, 10);
  $('fuCargo').value = editandoFunc.cargo || '';
  $('fuEmpregador').value = editandoFunc.empregador || '';
  $('fuCpf').value = editandoFunc.cpf || '';
  $('fuSetor').value = editandoFunc.setor || '';
  $('fuCalcado').value = editandoFunc.tam_calcado || '';
  $('fuCamisa').value = editandoFunc.tam_camisa || '';
  $('fuSituacao').value = editandoFunc.situacao || 'ATIVO';
  $('bApagarFunc').hidden = !f;
  $('dlgFunc').showModal();
}

$('bNovoFunc').addEventListener('click', () => abrirFuncionario(null));
['buscaFunc', 'fSitFunc'].forEach(id => $(id).addEventListener('input', desenharFuncionarios));

$('formFunc').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = {
    ...editandoFunc,
    nome: $('fuNome').value.trim().replace(/\s+/g, ' '),
    cadastro: $('fuCadastro').value.trim(),
    admissao: $('fuAdmissao').value || null,
    cargo: $('fuCargo').value.trim(),
    empregador: $('fuEmpregador').value.trim(),
    cpf: $('fuCpf').value.trim(),
    setor: $('fuSetor').value.trim(),
    tam_calcado: $('fuCalcado').value.trim(),
    tam_camisa: $('fuCamisa').value.trim(),
    situacao: $('fuSituacao').value,
  };
  if (!f.nome) return;
  await db.salvarFuncionario(f);
  $('dlgFunc').close();
  preencherControles(); desenharFuncionarios(); desenharSelecao();
});

$('bApagarFunc').addEventListener('click', async () => {
  if (!editandoFunc?.id) return;
  if (!confirm(`Apagar ${editandoFunc.nome}? As fichas salvas dele também saem.`)) return;
  await db.apagarFuncionario(editandoFunc.id);
  marcados.delete(editandoFunc.id);
  $('dlgFunc').close();
  desenharFuncionarios(); desenharSelecao();
});

/* =============== aba EPIS =============== */
function desenharEpis() {
  const q = $('buscaEpi').value.trim().toLowerCase();
  const lista = estado.epis.filter(e =>
    !q || [e.descricao, e.ca, e.atividade].some(v => String(v || '').toLowerCase().includes(q)));
  $('listaEpi').innerHTML = lista.length ? lista.map(e => `
    <div class="item" style="grid-template-columns:1fr auto">
      <span>
        <span class="nome">${esc(e.descricao)}</span><br>
        <span class="sub">${e.ca ? 'C.A ' + esc(e.ca) : 'sem C.A'}${e.observacao ? ' · ' + esc(e.observacao) : ''}${e.atividade ? ' · ' + esc(e.atividade) : ''}</span>
      </span>
      <span class="acoes"><button class="btn mini" data-editar="${e.id}">Editar</button></span>
    </div>`).join('')
    : '<div class="vazio">Nenhum EPI encontrado.</div>';
  $('listaEpi').querySelectorAll('[data-editar]').forEach(b =>
    b.addEventListener('click', () => abrirEpi(b.dataset.editar)));
}

function abrirEpi(id) {
  const e = id ? estado.epis.find(x => x.id === id) : null;
  editandoEpi = e ? { ...e } : { id: db.novoId(), ativo: true };
  $('tituloEpi').textContent = e ? 'Editar EPI' : 'Novo EPI';
  $('epDescricao').value = editandoEpi.descricao || '';
  $('epCa').value = editandoEpi.ca || '';
  $('epObs').value = editandoEpi.observacao || '';
  $('epAtividade').value = editandoEpi.atividade || '';
  $('bApagarEpi').hidden = !e;
  $('dlgEpi').showModal();
}

$('bNovoEpi').addEventListener('click', () => abrirEpi(null));
$('buscaEpi').addEventListener('input', desenharEpis);

$('formEpi').addEventListener('submit', async ev => {
  ev.preventDefault();
  const e = {
    ...editandoEpi,
    descricao: $('epDescricao').value.trim(),
    ca: $('epCa').value.trim(),
    observacao: $('epObs').value.trim(),
    atividade: $('epAtividade').value.trim(),
  };
  if (!e.descricao) return;
  await db.salvarEpi(e);
  $('dlgEpi').close();
  preencherControles(); desenharEpis();
});

$('bApagarEpi').addEventListener('click', async () => {
  if (!editandoEpi?.id) return;
  if (!confirm(`Apagar "${editandoEpi.descricao}" do catálogo?`)) return;
  await db.apagarEpi(editandoEpi.id);
  $('dlgEpi').close();
  preencherControles(); desenharEpis();
});

/* =============== aba MODELO =============== */
function preencherModelo() {
  const m = modeloAtual();
  $('mTitulo').value = m.titulo || '';
  $('mRotuloFaz').value = m.rotulo_faz || '';
  $('mRotuloMer').value = m.rotulo_mer || '';
  $('mLegFaz').value = (m.legenda_faz || []).join('\n');
  $('mLegMer').value = (m.legenda_mer || []).join('\n');
  $('mDeclTitulo').value = m.declaracao_titulo || '';
  $('mDecls').value = (m.declaracoes || []).join('\n');
  $('mDeclLonga').value = m.declaracao_longa || '';
  $('mRodape').value = m.rodape_demissao || '';
  $('mSetor').value = m.setor_padrao || '';
  $('mLinhas').value = m.linhas_padrao || 20;
}

const emLinhas = txt => txt.split('\n').map(s => s.trim()).filter(Boolean);

$('formModelo').addEventListener('submit', async ev => {
  ev.preventDefault();
  await db.salvarModelo({
    ...modeloAtual(),
    titulo: $('mTitulo').value,
    rotulo_faz: $('mRotuloFaz').value,
    rotulo_mer: $('mRotuloMer').value,
    legenda_faz: emLinhas($('mLegFaz').value),
    legenda_mer: emLinhas($('mLegMer').value),
    declaracao_titulo: $('mDeclTitulo').value,
    declaracoes: emLinhas($('mDecls').value),
    declaracao_longa: $('mDeclLonga').value,
    rodape_demissao: $('mRodape').value,
    setor_padrao: $('mSetor').value,
    linhas_padrao: Math.max(1, Math.min(40, parseInt($('mLinhas').value) || 20)),
  });
  atualizarFichas();
  const b = ev.submitter; if (b) { b.textContent = 'Salvo'; setTimeout(() => b.textContent = 'Salvar modelo', 1600); }
});

$('bRestaurarModelo').addEventListener('click', async () => {
  if (!confirm('Voltar todos os textos ao original da planilha?')) return;
  await db.salvarModelo({ ...SEED_MODELO });
  preencherModelo(); atualizarFichas();
});

/* =============== geral =============== */
document.querySelectorAll('.aba').forEach(b =>
  b.addEventListener('click', () => abrirAba(b.dataset.tela)));
document.querySelectorAll('[data-fechar]').forEach(b =>
  b.addEventListener('click', () => b.closest('dialog').close()));

db.aoMudar(() => {
  const online = estado.online;
  $('estadoTexto').textContent = estado.pendentes
    ? `${estado.pendentes} para enviar`
    : (online ? 'sincronizado' : 'offline');
  $('estadoRede').querySelector('.pt').classList.toggle('off', !online || estado.pendentes > 0);
});

/* instalação do PWA */
let promptInstalar = null;
addEventListener('beforeinstallprompt', ev => {
  ev.preventDefault();
  promptInstalar = ev;
  $('btnInstalar').hidden = false;
});
$('btnInstalar').addEventListener('click', async () => {
  if (!promptInstalar) return;
  promptInstalar.prompt();
  await promptInstalar.userChoice;
  promptInstalar = null;
  $('btnInstalar').hidden = true;
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* arranque */
(async () => {
  const r = await db.iniciar();
  mostrar(r.etapa);
  if (r.etapa === 'app') await carregarTudo();
})();
