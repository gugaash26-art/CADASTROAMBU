import { addRecords } from "./storage.js";
import { friendlyError, recordFromForm, setStatus, validateRecord } from "./common.js";

const recordForm = document.querySelector("#record-form");
const formStatus = document.querySelector("#form-status");
const saveButton = recordForm.querySelector('button[type="submit"]');

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recordForm.reportValidity()) return;

  const fields = recordFromForm(recordForm);
  const validationError = validateRecord(fields);
  if (validationError) {
    setStatus(formStatus, validationError, true);
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Salvando viagem…";
  setStatus(formStatus, "");
  try {
    const timestamp = new Date().toISOString();
    const record = { ...fields, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp };
    await addRecords([record]);
    recordForm.reset();
    setStatus(formStatus, "Viagem salva. Para baixar todos os registros em ODS, acesse “Histórico e ODS”. A saída pode ser registrada depois.");
  } catch (error) {
    setStatus(formStatus, friendlyError(error), true);
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = '<span class="button-icon" aria-hidden="true">＋</span> Salvar viagem';
  }
});
