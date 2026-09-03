// aniversarios.js — folha de aniversariantes do mês, em A4 retrato, no padrão
// visual da SAKUMA (verde #84BD00, marrom #744F28, cinza #51534A, Arial).
import { LOGO } from './seed.js';
import { MESES } from './ficha.js';

const LINHAS_POR_FOLHA = 22;

const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const partes = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? { ano: +m[1], mes: +m[2] - 1, dia: +m[3] } : null;
};

/**
 * Aniversariantes de um mês, em ordem de dia.
 * @param {Array} funcionarios  lista do cadastro
 * @param {number} mes          0 a 11
 * @param {boolean} soAtivos
 */
export function aniversariantes(funcionarios, mes, soAtivos = true) {
  return funcionarios
    .filter(f => (!soAtivos || f.situacao === 'ATIVO'))
    .map(f => ({ f, p: partes(f.nascimento) }))
    .filter(x => x.p && x.p.mes === mes)
    .sort((a, b) => a.p.dia - b.p.dia || a.f.nome.localeCompare(b.f.nome, 'pt-BR'))
    .map(x => ({ ...x.f, dia: x.p.dia, nascimentoP: x.p }));
}

/** Quantos do cadastro ainda estão sem data de nascimento. */
export const semNascimento = (funcionarios, soAtivos = true) =>
  funcionarios.filter(f => (!soAtivos || f.situacao === 'ATIVO') && !partes(f.nascimento)).length;

/* ---------------- folha impressa ---------------- */
export function montarAniversarios(lista, mes, ano) {
  const titulo = `ANIVERSARIANTES DE ${MESES[mes].toUpperCase()}`;
  const total = Math.max(1, Math.ceil(lista.length / LINHAS_POR_FOLHA));
  const folhas = [];

  for (let p = 0; p < total; p++) {
    const fatia = lista.slice(p * LINHAS_POR_FOLHA, (p + 1) * LINHAS_POR_FOLHA);
    const linhas = fatia.length
      ? fatia.map(a => `<tr>
          <td class="an-dia">${String(a.dia).padStart(2, '0')}</td>
          <td class="an-nome">${esc(a.nome)}${a.apelido ? ` <span class="an-apelido">(${esc(a.apelido)})</span>` : ''}</td>
        </tr>`).join('')
      : `<tr><td colspan="2" class="an-vazio">Nenhum aniversariante neste mês.</td></tr>`;

    folhas.push(`<div class="an-folha">
      <div class="an-topo">
        <img src="${LOGO}" alt="">
        <div class="an-tit">
          <h1>${titulo}</h1>
          <p>${ano} · SAKUMA Agronegócios</p>
        </div>
      </div>
      <table class="an-tab">
        <colgroup><col style="width:18mm"><col></colgroup>
        <thead><tr><th>DIA</th><th>NOME</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <div class="an-pe">
        <span>${lista.length} aniversariante(s) em ${MESES[mes]}</span>
        <span>Guilherme Lopes${total > 1 ? ` · folha ${p + 1} de ${total}` : ''}</span>
      </div>
    </div>`);
  }
  return folhas.join('');
}

/* ---------------- WhatsApp ---------------- */
/** Texto para mandar no grupo. O WhatsApp usa *asterisco* para negrito. */
export function textoWhatsapp(lista, mes, ano) {
  const cabeca = `*Aniversariantes de ${MESES[mes]} de ${ano}*`;
  if (!lista.length) return `${cabeca}\n\nNinguém faz aniversário neste mês.`;
  const linhas = lista.map(a =>
    `${String(a.dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')} - ` +
    (a.apelido ? `${a.nome} (${a.apelido})` : a.nome));
  return `${cabeca}\n\n${linhas.join('\n')}\n\nSAKUMA Agronegócios`;
}

/** Abre o WhatsApp já com o texto pronto; a conversa quem escolhe é ele. */
export const linkWhatsapp = texto => `https://wa.me/?text=${encodeURIComponent(texto)}`;
