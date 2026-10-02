export const FIELD_NAMES = {
  entrada: "Horário de entrada",
  saida: "Horário de saída",
  motorista: "Motorista",
  empresa: "Empresa",
  veiculo: "Placa ou prefixo",
  paciente: "Nome do paciente",
  nascimento: "Data de nascimento",
  origem: "Local de origem",
  tipo: "Tipo de atendimento",
};

export function recordFromForm(form) {
  const data = new FormData(form);
  return Object.fromEntries(Object.entries(FIELD_NAMES).map(([key]) => [key, String(data.get(key) || "").trim()]));
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && date <= today;
}

export function validateRecord(record) {
  for (const [key, label] of Object.entries(FIELD_NAMES)) {
    if (key === "saida" && !String(record[key] || "").trim()) continue;
    if (!String(record[key] || "").trim()) return `${label}: preencha este campo.`;
  }
  for (const key of ["entrada", "saida"]) {
    if (key === "saida" && !record[key]) continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(record[key])) return `${FIELD_NAMES[key]}: informe um horário válido.`;
  }
  if (!validIsoDate(record.nascimento)) return "Data de nascimento: informe uma data válida que não esteja no futuro.";
  if (!["Emergência", "Consulta/retorno"].includes(record.tipo)) return "Escolha Emergência ou Consulta/retorno.";
  return "";
}

export function displayDate(value) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value || "—");
}

export function sortedRecords(records) {
  return [...records].sort((first, second) => {
    const byDate = String(first.createdAt || "").localeCompare(String(second.createdAt || ""));
    return byDate || String(first.id).localeCompare(String(second.id));
  });
}

export function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
}

export function friendlyError(error) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "O espaço local do navegador está cheio. Baixe seu ODS antes de liberar espaço.";
  }
  return error instanceof Error ? error.message : "Algo deu errado. Tente novamente.";
}
