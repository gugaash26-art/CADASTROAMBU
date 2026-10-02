import { strToU8, zipSync } from "../vendor/fflate.js";

export const ODS_MIME = "application/vnd.oasis.opendocument.spreadsheet";
export const ODS_HEADERS = [
  ["entrada", "Horário de entrada"],
  ["saida", "Horário de saída"],
  ["motorista", "Motorista"],
  ["empresa", "Empresa"],
  ["veiculo", "Placa ou prefixo"],
  ["paciente", "Nome do paciente"],
  ["nascimento", "Data de nascimento"],
  ["origem", "Local de origem"],
  ["tipo", "Tipo de atendimento"],
];

function cleanXmlText(input) {
  const clean = String(input ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
  return clean.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function textCell(value) {
  return `<table:table-cell office:value-type="string"><text:p>${cleanXmlText(value)}</text:p></table:table-cell>`;
}

function registrationOrder(records) {
  return [...records].sort((first, second) => {
    const byDate = String(first.createdAt || "").localeCompare(String(second.createdAt || ""));
    return byDate || String(first.id).localeCompare(String(second.id));
  });
}

function createContentXml(records) {
  const header = `<table:table-row>${ODS_HEADERS.map(([, label]) => textCell(label)).join("")}</table:table-row>`;
  const rows = registrationOrder(records).map((record) => `<table:table-row>${ODS_HEADERS.map(([key]) => textCell(record[key])).join("")}</table:table-row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:automatic-styles/><office:body><office:spreadsheet><table:table table:name="Controle de Ambulâncias"><table:table-column table:number-columns-repeated="9"/>${header}${rows}</table:table></office:spreadsheet></office:body></office:document-content>`;
}

function createManifestXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="${ODS_MIME}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
}

export function createOdsBlob(records) {
  const files = {
    mimetype: strToU8(ODS_MIME),
    "content.xml": strToU8(createContentXml(records)),
    "META-INF/manifest.xml": strToU8(createManifestXml()),
  };
  // OpenDocument requires mimetype to be the first ZIP entry and stored uncompressed.
  const bytes = zipSync(files, { level: 0 });
  return new Blob([bytes], { type: ODS_MIME });
}

function localDateStamp(date) {
  const pad = (number) => String(number).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${milliseconds}`;
}

export function downloadOds(records) {
  const blob = createOdsBlob(records);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `controle-de-ambulancias_${localDateStamp(new Date())}.ods`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
