// ficha.js — reproduz a aba "Ficha EPI" da planilha, celula por celula.
// Larguras, alturas, fontes e bordas vem direto do arquivo original,
// convertidas com a escala de impressao de 42% usada na planilha.
import { LOGO } from './seed.js';

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const COLUNAS = ['faz', 'data', 'qtd', 'ca', 'descricao', 'devolucao', 'assinatura', 'mer'];
export const TRACO = '_____/_____/_______';

export const linhaVazia = () =>
  ({ faz: '', data: '', qtd: '', ca: '', descricao: '', devolucao: '', assinatura: '', mer: '' });

const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const dataBr = iso => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** Celula editavel: input transparente com os tracos aparecendo quando vazia. */
function celula(campo, indice, valor, classes, marca) {
  const v = valor || '';
  const ph = marca ? `<span class="ph">${marca}</span>` : '';
  return `<td class="cel ${classes}"><div class="cw${v ? ' preenchida' : ''}">` +
    `<input class="cx" data-linha="${indice}" data-campo="${campo}" value="${esc(v)}"` +
    (campo === 'descricao' ? ' list="lista-epis" autocomplete="off"' : '') + `>${ph}</div></td>`;
}

export function montarFicha(func, modelo, opcoes) {
  const { mes, ano, linhas, chave } = opcoes;
  const setor = opcoes.setor || func.setor || modelo.setor_padrao || 'CAMPO';
  const mesTexto = `${MESES[mes]}, ${ano}`;
  const fazLeg = modelo.legenda_faz || [];
  const merLeg = modelo.legenda_mer || [];
  const decls = modelo.declaracoes || [];

  const linhaHtml = (l, i) => '<tr class="r43">' +
    celula('faz', i, l.faz, 'f14 ce brt btt bbt') +
    celula('data', i, l.data, 'f12 b ce brt btt bbt', TRACO) +
    celula('qtd', i, l.qtd, 'f14 ce blt brt btt bbt') +
    celula('ca', i, l.ca, 'f14 ce blt brt btt bbt') +
    celula('descricao', i, l.descricao, 'f14 es blt brt btt bbt') +
    celula('devolucao', i, l.devolucao, 'f12 b ce brt btt bbt', TRACO) +
    celula('assinatura', i, l.assinatura, 'f14 es blt brt btt bbt') +
    celula('mer', i, l.mer, 'f10 ce blt btt bbt') +
    '</tr>';

  return `<div class="ficha" data-chave="${esc(chave)}">
  <table class="fx"><colgroup>
    <col style="width:4.729%"><col style="width:13.997%"><col style="width:5.296%"><col style="width:9.269%">
    <col style="width:22.005%"><col style="width:13.997%"><col style="width:22.131%"><col style="width:8.575%">
  </colgroup><tbody>
  <tr class="r6">
    <td class="logo" colspan="2" rowspan="5"><span class="marca"><img src="${LOGO}" alt=""></span></td>
    <td colspan="2" class="brm"></td>
    <td class="f12 b es vm brt bbt">${esc(modelo.rotulo_faz)}</td>
    <td colspan="3" class="f12 b ce vm bbt">${esc(modelo.rotulo_mer)}</td>
  </tr>
  <tr class="r6">
    <td colspan="2" class="f19 b ce vm brm">MÊS: </td>
    <td class="f12 es vm brt btt bbt">${esc(fazLeg[0])}</td>
    <td colspan="3" class="f12 vm btt bbt">${esc(merLeg[0])}</td>
  </tr>
  <tr class="r6">
    <td colspan="2" class="f19 b ce vm brm">${esc(mesTexto)}</td>
    <td class="f12 es vm brt btt bbt">${esc(fazLeg[1])}</td>
    <td colspan="3" class="f12 vm btt bbt">${esc(merLeg[1])}</td>
  </tr>
  <tr class="r6">
    <td colspan="2" class="brm"></td>
    <td class="f12 es vm brt btt bbt">${esc(fazLeg[2])}</td>
    <td colspan="3" class="f12 vm btt bbt">${esc(merLeg[2])}</td>
  </tr>
  <tr class="r6">
    <td colspan="2" class="brm"></td>
    <td class="f12 es vm brt btt">${esc(fazLeg[3])}</td>
    <td colspan="3" class="f12 vm btt">${esc(merLeg[3])}</td>
  </tr>

  <tr class="r12"><td colspan="8" class="titulo btm">${esc(modelo.titulo)}</td></tr>
  <tr class="r12"><td colspan="8"></td></tr>

  <tr class="r12">
    <td colspan="2" class="f20 b es vm btt bbt">EMPREGADOR:</td>
    <td colspan="6" class="f20 b es vm btt bbt">${esc(func.empregador)}</td>
  </tr>
  <tr class="r12">
    <td colspan="2" class="f20 b es vm btt">CARGO: </td>
    <td colspan="3" class="f20 b es vm">${esc(func.cargo)}</td>
    <td class="f20 b ce vm btt bbt">SETOR:</td>
    <td colspan="2" class="f20 b es vm bbt">${esc(setor)}</td>
  </tr>
  <tr class="r12">
    <td colspan="2" class="f20 b es vm btt bbt">FUNCIONÁRIO: </td>
    <td colspan="5" class="f20 es vm brt btt bbt">${esc(func.nome)}</td>
    <td class="f20 b ce vm btt">${esc(func.cadastro)}</td>
  </tr>
  <tr class="r12">
    <td colspan="2" class="f20 b es vm btt bbt">ADMISSÃO:</td>
    <td colspan="3" class="f20 b es vm brt btt bbt">${esc(dataBr(func.admissao))}</td>
    <td colspan="3" class="f20 es vm blt btt bbt">${esc(modelo.rodape_demissao)}</td>
  </tr>

  <tr class="r18"><td colspan="8" class="f16 b es vm nowrap">${esc(modelo.declaracao_titulo)}</td></tr>
  ${decls.map(t => `<tr class="r18"><td colspan="8" class="decl">${esc(t)}</td></tr>`).join('')}
  <tr><td colspan="8" class="decl" style="height:var(--h20)">${esc(modelo.declaracao_longa)}</td></tr>

  <tr class="r21"><td colspan="8" class="assinlinha">_____________________________________</td></tr>
  <tr class="r22"><td colspan="8" class="assinnome">${esc(func.nome)}</td></tr>

  <tr class="r23">
    <td class="f12 b ce vm btm brt bbt">FAZ</td>
    <td class="f12 b ce vm btm brt bbt">DATA</td>
    <td class="f12 b ce vm btm blt brt bbt">QTD.</td>
    <td class="f12 b ce vm btm blt brt bbt">C.A</td>
    <td class="f12 b ce vm btm blt brt bbt">DESCRIÇÃO DO EPI</td>
    <td class="f12 b ce vm btm blt brt bbt">DEVOLUÇÃO</td>
    <td class="f12 b ce vm btm blt brt bbt">ASSINATURA</td>
    <td class="f12 b ce vm btm blt bbt">M.E.R</td>
  </tr>
  ${linhas.map(linhaHtml).join('')}
  </tbody></table></div>`;
}
