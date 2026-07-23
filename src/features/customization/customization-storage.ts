export type CustomizationMode = "choose" | "agent" | "brief";
export type CustomizationIntent = "apply_artwork" | "text_only" | "maker_reference";
export type CustomizationStatus = "idle" | "rendering" | "ready" | "error";

export type CustomizationPreview = { url: string; label: string; backgroundPosition?: string };

export type CustomizationSession = {
  schemaVersion: 4;
  productSlug: string;
  mode: CustomizationMode;
  intent: CustomizationIntent;
  status: CustomizationStatus;
  notes: string;
  prompt?: string;
  file?: File;
  fileName?: string;
  previews: CustomizationPreview[];
  selectedPreview?: string;
  renderId?: string;
  renderStartedAt?: number;
  submittedAt?: number;
  renderDemo: boolean;
  updatedAt: number;
};

const DATABASE = "loomon-customization";
const STORE = "sessions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "productSlug" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCustomization(productSlug: string): Promise<CustomizationSession | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(productSlug);
    request.onsuccess = () => resolve(request.result as CustomizationSession | undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveCustomization(session: CustomizationSession): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(session);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}
