const DATABASE_NAME = "rota-ods-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "registros";

let databasePromise;

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error("Este navegador não oferece armazenamento local compatível."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error || new Error("Não foi possível abrir o histórico local."));
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error("Feche outras abas do Controle de Ambulâncias e tente novamente."));
    };
  });
  return databasePromise;
}

function runTransaction(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    transaction.oncomplete = () => {
      const value = result && typeof result === "object" && "result" in result ? result.result : result;
      resolve(value);
    };
    transaction.onerror = () => reject(transaction.error || new Error("Falha ao atualizar o histórico."));
    transaction.onabort = () => reject(transaction.error || new Error("A atualização do histórico foi cancelada."));
    try {
      result = operation(store);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  }));
}

export async function getAllRecords() {
  const records = await runTransaction("readonly", (store) => store.getAll());
  if (!Array.isArray(records)) throw new Error("Não foi possível carregar a lista de registros. Atualize a página e tente novamente.");
  return records.sort((first, second) => {
    const byDate = String(first.createdAt || "").localeCompare(String(second.createdAt || ""));
    return byDate || String(first.id).localeCompare(String(second.id));
  });
}

export function addRecords(records) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Falha ao salvar a viagem."));
    transaction.onabort = () => reject(transaction.error || new Error("O salvamento da viagem foi cancelado."));

    try {
      const latestRequest = store.index("createdAt").openCursor(null, "prev");
      latestRequest.onerror = () => transaction.abort();
      latestRequest.onsuccess = () => {
        try {
          const latestTimestamp = Date.parse(String(latestRequest.result?.key || ""));
          let nextTimestamp = Math.max(Date.now(), Number.isFinite(latestTimestamp) ? latestTimestamp + 1 : 0);
          for (const record of records) {
            const createdAt = new Date(nextTimestamp++).toISOString();
            store.add({ ...record, createdAt, updatedAt: createdAt });
          }
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  }));
}

export function updateRecord(record) {
  return runTransaction("readwrite", (store) => store.put(record));
}

export function deleteRecord(id) {
  return runTransaction("readwrite", (store) => store.delete(id));
}
