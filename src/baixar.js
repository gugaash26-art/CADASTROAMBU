import { deleteRecord, getAllRecords, updateRecord } from "./storage.js";
import { downloadOds } from "./ods.js";
import { displayDate, friendlyError, recordFromForm, setStatus, validateRecord } from "./common.js";

const recordCount = document.querySelector("#record-count");
const emergencyCount = document.querySelector("#emergency-count");
const consultCount = document.querySelector("#consult-count");
const pendingCount = document.querySelector("#pending-count");
const downloadButton = document.querySelector("#download-button");
const searchInput = document.querySelector("#search-input");
const typeFilter = document.querySelector("#type-filter");
const tableWrap = document.querySelector("#table-wrap");
const recordRows = document.querySelector("#record-rows");
const emptyState = document.querySelector("#empty-state");
const noResults = document.querySelector("#no-results");
const historyStatus = document.querySelector("#history-status");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editStatus = document.querySelector("#edit-status");
const columnFields = ["entrada", "saida", "motorista", "empresa", "veiculo", "paciente", "nascimento", "origem"];

let records = [];

function normalizedSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function makeCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text || "—";
  if (className) cell.className = className;
  return cell;
}

function makeRow(record) {
  const row = document.createElement("tr");
  for (const key of columnFields) {
    if (key === "saida" && !record.saida) {
      const cell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "pending-badge";
      badge.textContent = "Aguardando saída";
      cell.append(badge);
      row.append(cell);
      continue;
    }
    const value = key === "nascimento" ? displayDate(record[key]) : record[key];
    row.append(makeCell(value, key === "paciente" ? "patient-cell" : ""));
  }

  const typeCell = document.createElement("td");
  const typeBadge = document.createElement("span");
  typeBadge.className = `type-badge${record.tipo === "Emergência" ? " emergency" : ""}`;
  typeBadge.textContent = record.tipo;
  typeCell.append(typeBadge);
  row.append(typeCell);

  const actionCell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (!record.saida) {
    const departureButton = document.createElement("button");
    departureButton.type = "button";
    departureButton.className = "row-action departure";
    departureButton.dataset.action = "departure";
    departureButton.dataset.id = record.id;
    departureButton.textContent = "Registrar saída";
    departureButton.setAttribute("aria-label", `Registrar horário de saída da ambulância de ${record.paciente}`);
    actions.append(departureButton);
  }
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "row-action";
  editButton.dataset.action = "edit";
  editButton.dataset.id = record.id;
  editButton.textContent = "Editar";
  editButton.setAttribute("aria-label", `Editar viagem de ${record.paciente}`);
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "row-action delete";
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.id = record.id;
  deleteButton.textContent = "Excluir";
  deleteButton.setAttribute("aria-label", `Excluir viagem de ${record.paciente}`);
  actions.append(editButton, deleteButton);
  actionCell.append(actions);
  row.append(actionCell);
  return row;
}

function getVisibleRecords() {
  const query = normalizedSearch(searchInput.value.trim());
  const type = typeFilter.value;
  return records.filter((record) => {
    const matchesType = !type || record.tipo === type;
    const searchable = normalizedSearch([record.paciente, record.motorista, record.empresa, record.veiculo, record.origem].join(" "));
    return matchesType && (!query || searchable.includes(query));
  });
}

function render() {
  const emergencyTotal = records.filter((record) => record.tipo === "Emergência").length;
  const pendingTotal = records.filter((record) => !record.saida).length;
  recordCount.textContent = String(records.length);
  emergencyCount.textContent = String(emergencyTotal);
  consultCount.textContent = String(records.length - emergencyTotal);
  pendingCount.textContent = String(pendingTotal);
  downloadButton.disabled = records.length === 0;

  const visible = getVisibleRecords();
  recordRows.replaceChildren(...visible.map(makeRow));
  emptyState.hidden = records.length !== 0;
  tableWrap.hidden = visible.length === 0;
  noResults.hidden = records.length === 0 || visible.length !== 0;
}

async function reloadRecords() {
  records = await getAllRecords();
  render();
}

function openEditDialog(id, initialField = "motorista") {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  editForm.reset();
  for (const key of ["id", ...columnFields, "tipo"]) {
    const input = editForm.elements.namedItem(key);
    if (input) input.value = record[key] || "";
  }
  setStatus(editStatus, "");
  editDialog.showModal();
  editForm.elements.namedItem(initialField).focus();
}

recordRows.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit" || button.dataset.action === "departure") {
    openEditDialog(button.dataset.id, button.dataset.action === "departure" ? "saida" : "motorista");
    return;
  }
  const record = records.find((item) => item.id === button.dataset.id);
  if (!record) return;
  const message = `Excluir a viagem de ${record.paciente}? Esta ação remove o registro salvo.`;
  if (!window.confirm(message)) return;

  button.disabled = true;
  setStatus(historyStatus, "");
  try {
    await deleteRecord(record.id);
    await reloadRecords();
    setStatus(historyStatus, "Viagem excluída. O histórico foi atualizado; baixe o ODS completo quando quiser.");
  } catch (error) {
    setStatus(historyStatus, friendlyError(error), true);
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editForm.reportValidity()) return;
  const id = String(new FormData(editForm).get("id") || "");
  const current = records.find((record) => record.id === id);
  if (!current) {
    setStatus(editStatus, "Não encontrei essa viagem. Atualize a página e tente novamente.", true);
    return;
  }
  const fields = recordFromForm(editForm);
  const validationError = validateRecord(fields);
  if (validationError) {
    setStatus(editStatus, validationError, true);
    return;
  }
  const saveButton = editForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  setStatus(editStatus, "Salvando atualização…");
  try {
    await updateRecord({ ...current, ...fields, updatedAt: new Date().toISOString() });
    await reloadRecords();
    editDialog.close();
    setStatus(historyStatus, "Viagem atualizada. O histórico foi salvo; baixe o ODS completo quando quiser.");
  } catch (error) {
    setStatus(editStatus, friendlyError(error), true);
  } finally {
    saveButton.disabled = false;
  }
});

for (const button of editDialog.querySelectorAll("[data-close-dialog]")) {
  button.addEventListener("click", () => editDialog.close());
}
editDialog.addEventListener("click", (event) => {
  if (event.target === editDialog) editDialog.close();
});

searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);
downloadButton.addEventListener("click", async () => {
  if (downloadButton.disabled) return;
  downloadButton.disabled = true;
  setStatus(historyStatus, "Preparando o ODS com todos os registros salvos…");
  try {
    const completeRecords = await getAllRecords();
    records = completeRecords;
    render();
    downloadButton.disabled = true;
    if (!completeRecords.length) {
      setStatus(historyStatus, "Ainda não há registros salvos para baixar.");
      return;
    }
    downloadOds(completeRecords);
    const countLabel = `${completeRecords.length} ${completeRecords.length === 1 ? "registro" : "registros"}`;
    setStatus(historyStatus, `Download iniciado: ODS completo com todos os ${countLabel}, na ordem de cadastro. Os filtros não limitam a planilha.`);
  } catch (error) {
    setStatus(historyStatus, friendlyError(error), true);
  } finally {
    downloadButton.disabled = records.length === 0;
  }
});

try {
  await reloadRecords();
} catch (error) {
  downloadButton.disabled = true;
  setStatus(historyStatus, friendlyError(error), true);
}
