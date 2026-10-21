/**
 * Postos de Reserva — Grupo SERVNAC
 * Backend em Google Apps Script: recebe os registros do site (GitHub Pages)
 * e grava na planilha Google onde este script está instalado.
 *
 * Abas criadas automaticamente:
 *   Reservas       → dados brutos de entrada e saída da reserva
 *   Movimentacoes  → dados brutos da situação do dia
 *   Planilha       → visão consolidada nas 14 colunas (recalculada a cada lançamento)
 */

const ABA_RES = "Reservas";
const ABA_MOV = "Movimentacoes";
const ABA_PLAN = "Planilha";

const RES_COLS = ["id", "matricula", "nome", "filial", "funcao", "escala", "tipo", "motivo", "motivoOutro",
  "entrada", "previsaoSaida", "saidaEfetiva", "motivoSaida", "postoFixo", "filialFixo", "dataDesligamento",
  "diasAfastamento", "regiaoFerias", "criadoEm", "saidaRegistradaEm", "turno",
  "feriasFilial", "feriasPosto", "feriasMatCoberto", "feriasNomeCoberto", "intrajornada", "previstaContrato"];
const MOV_COLS = ["id", "situacao", "data", "matricula", "nome", "filial", "funcao", "escala", "local",
  "matCoberto", "nomeCoberto", "motivo", "criadoEm", "turno", "escalaCoberto", "horario", "intrajornada"];
const SAIDA_CAMPOS = ["saidaEfetiva", "motivoSaida", "postoFixo", "filialFixo", "dataDesligamento",
  "diasAfastamento", "regiaoFerias", "saidaRegistradaEm",
  "feriasFilial", "feriasPosto", "feriasMatCoberto", "feriasNomeCoberto"];

const PLAN_COLS = ["Matrícula", "Nome do colaborador", "Filial", "Função", "Escala", "Tipo de reserva",
  "Motivo da entrada", "Entrada na reserva", "Previsão de saída", "Saída efetiva", "Data do Registro",
  "Situação do dia", "Local da cobertura", "Matrícula do titular"];
const SIT = { cobertura: "Em cobertura", programado: "Programado", disponivel: "Disponível",
  nao_utilizado: "Não utilizado", folga: "Folga", ocorrencia: "Ocorrência" };

/** Rode esta função uma vez pelo editor para criar as abas. */
function setup() {
  aba_(ABA_RES, RES_COLS);
  aba_(ABA_MOV, MOV_COLS);
  reconstruirPlanilha_();
}

function doGet() {
  try {
    return json_({ ok: true, reservas: ler_(ABA_RES, RES_COLS), movs: ler_(ABA_MOV, MOV_COLS) });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const agora = new Date().toISOString();
    if (body.action === "addReserva") {
      exigir_(body.data, ["matricula", "nome", "filial", "funcao", "escala", "tipo", "motivo", "entrada"]);
      inserir_(ABA_RES, RES_COLS, Object.assign({}, body.data, { criadoEm: agora }));
    } else if (body.action === "addMov") {
      exigir_(body.data, ["situacao", "matricula", "nome", "data"]);
      inserir_(ABA_MOV, MOV_COLS, Object.assign({}, body.data, { criadoEm: agora }));
    } else if (body.action === "addMovs") {
      const lista = Array.isArray(body.data) ? body.data : [];
      if (!lista.length || lista.length > 62) throw new Error("Quantidade de dias inválida.");
      lista.forEach(d => exigir_(d, ["situacao", "matricula", "nome", "data"]));
      lista.forEach(d => inserir_(ABA_MOV, MOV_COLS, Object.assign({}, d, { criadoEm: agora })));
    } else if (body.action === "saida") {
      exigir_(body.data, ["saidaEfetiva", "motivoSaida"]);
      const dados = {};
      SAIDA_CAMPOS.forEach(c => { if (c in body.data) dados[c] = body.data[c]; });
      dados.saidaRegistradaEm = agora;
      atualizar_(ABA_RES, RES_COLS, body.id, dados);
    } else if (body.action === "delete") {
      const nome = body.tipo === "reservas" ? ABA_RES : body.tipo === "movimentacoes" ? ABA_MOV : null;
      if (!nome) throw new Error("Tipo de registro inválido.");
      excluir_(nome, body.id);
    } else {
      throw new Error("Ação desconhecida.");
    }
    reconstruirPlanilha_();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- planilha consolidada (14 colunas) ---------- */
function reconstruirPlanilha_() {
  const reservas = ler_(ABA_RES, RES_COLS);
  const movs = ler_(ABA_MOV, MOV_COLS);
  const porMat = {};
  reservas.forEach(r => (porMat[r.matricula] = porMat[r.matricula] || []).push(r));
  Object.values(porMat).forEach(l => l.sort((a, b) => String(b.entrada).localeCompare(String(a.entrada))));

  const usadas = {}, linhas = [];
  movs.forEach(mv => {
    const lista = porMat[mv.matricula] || [];
    const r = lista.find(x => x.entrada <= mv.data && (!x.saidaEfetiva || x.saidaEfetiva >= mv.data)) || lista[0];
    if (r) usadas[r.id] = true;
    linhas.push({ r: r || {}, mv: mv });
  });
  reservas.forEach(r => { if (!usadas[r.id]) linhas.push({ r: r, mv: {} }); });

  linhas.sort((a, b) => {
    const ma = a.r.matricula || a.mv.matricula || "", mb = b.r.matricula || b.mv.matricula || "";
    return ma.localeCompare(mb, "pt", { numeric: true }) ||
      String(a.mv.data || a.r.entrada || "").localeCompare(String(b.mv.data || b.r.entrada || ""));
  });

  const valores = linhas.map(({ r, mv }) => [
    r.matricula || mv.matricula || "",
    r.nome || mv.nome || "",
    r.filial || mv.filial || "",
    r.funcao || mv.funcao || "",
    r.escala || mv.escala || "",
    r.tipo || "",
    r.motivo ? r.motivo + (r.motivoOutro ? ": " + r.motivoOutro : "") : "",
    data_(r.entrada), data_(r.previsaoSaida), data_(r.saidaEfetiva), data_(mv.data),
    mv.situacao ? SIT[mv.situacao] || mv.situacao : "",
    mv.local || "",
    mv.matCoberto || ""
  ]);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_PLAN) || ss.insertSheet(ABA_PLAN, 0);
  sh.clearContents();
  sh.getRange(1, 1, 1, PLAN_COLS.length).setValues([PLAN_COLS]).setFontWeight("bold");
  sh.setFrozenRows(1);
  if (valores.length) {
    sh.getRange(2, 1, valores.length, 1).setNumberFormat("@");
    sh.getRange(2, 14, valores.length, 1).setNumberFormat("@");
    sh.getRange(2, 1, valores.length, PLAN_COLS.length).setValues(valores);
    sh.getRange(2, 8, valores.length, 4).setNumberFormat("dd/MM/yyyy");
  }
}

/* ---------- utilitários ---------- */
function aba_(nome, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("A:Z").setNumberFormat("@"); // tudo como texto: preserva matrícula e datas
  } else {
    // acrescenta colunas novas (ex.: turno) em abas criadas por versões anteriores
    const ultima = Math.max(sh.getLastColumn(), 1);
    const head = sh.getRange(1, 1, 1, ultima).getDisplayValues()[0];
    const faltam = cols.filter(c => head.indexOf(c) < 0);
    if (faltam.length) sh.getRange(1, ultima + 1, 1, faltam.length).setValues([faltam]).setFontWeight("bold");
  }
  return sh;
}

function ler_(nome, cols) {
  const sh = aba_(nome, cols);
  const v = sh.getDataRange().getDisplayValues();
  const head = v.shift() || [];
  return v.filter(l => l[0]).map(l => {
    const o = {};
    head.forEach((h, i) => (o[h] = l[i]));
    return o;
  });
}

function inserir_(nome, cols, dados) {
  const sh = aba_(nome, cols);
  dados.id = Utilities.getUuid();
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const linha = sh.getLastRow() + 1;
  const rng = sh.getRange(linha, 1, 1, head.length);
  rng.setNumberFormat("@");
  rng.setValues([head.map(c => texto_(dados[c]))]);
}

function linhaDoId_(sh, id) {
  if (!id) throw new Error("Registro não informado.");
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues();
  for (let i = 1; i < ids.length; i++) if (ids[i][0] === id) return i + 1;
  throw new Error("Registro não encontrado. Ele pode já ter sido excluído.");
}

function atualizar_(nome, cols, id, dados) {
  const sh = aba_(nome, cols);
  const linha = linhaDoId_(sh, id);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  Object.keys(dados).forEach(c => {
    const col = head.indexOf(c);
    if (col >= 0) sh.getRange(linha, col + 1).setNumberFormat("@").setValue(texto_(dados[c]));
  });
}

function excluir_(nome, id) {
  const sh = aba_(nome, nome === ABA_RES ? RES_COLS : MOV_COLS);
  sh.deleteRow(linhaDoId_(sh, id));
}

/** Grava sempre como texto: mantém zeros à esquerda (matrícula 0001, filial 0101) e datas como estão. */
function texto_(v) {
  if (v == null || v === "") return "";
  return "'" + String(v);
}

function exigir_(d, campos) {
  if (!d) throw new Error("Dados não enviados.");
  campos.forEach(c => { if (!String(d[c] || "").trim()) throw new Error("Campo obrigatório vazio: " + c); });
}

function data_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : "";
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
