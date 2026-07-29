export type CustomizationMode = "choose" | "agent" | "brief";
export type CustomizationIntent = "apply_artwork" | "text_only" | "maker_reference";
export type CustomizationStatus = "idle" | "rendering" | "ready" | "error";

export type CustomizationPreview = { url: string; label: string; backgroundPosition?: string };

export type CustomizationSession = {
  schemaVersion: 7;
  productSlug: string;
  mode: CustomizationMode;
  intent: CustomizationIntent;
  status: CustomizationStatus;
  printText: string;
  artworkDescription: string;
  notes: string;
  quantity: number;
  requiredBy: string;
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

export function createEmptyCustomizationSession(productSlug: string): CustomizationSession {
  return {
    schemaVersion: 7,
    productSlug,
    mode: "choose",
    intent: "apply_artwork",
    status: "idle",
    printText: "",
    artworkDescription: "",
    notes: "",
    quantity: 1,
    requiredBy: "",
    previews: [],
    renderDemo: false,
    updatedAt: Date.now(),
  };
}

export function normalizeCustomizationSession(
  productSlug: string,
  minimumOrderQuantity: number,
  stored?: CustomizationSession,
): CustomizationSession {
  const empty = createEmptyCustomizationSession(productSlug);
  if (!stored) return empty;
  const legacy = stored as CustomizationSession & {
    schemaVersion?: number;
    prompt?: string;
    printText?: string;
    artworkDescription?: string;
    quantity?: number;
    requiredBy?: string;
  };
  const legacyPrompt = legacy.prompt ?? "";
  const legacyDefault = "Place this artwork naturally on the product. Keep the artwork proportions and colors faithful.";
  return {
    ...empty,
    ...stored,
    schemaVersion: 7,
    productSlug,
    mode: (stored.mode as string) === "manual" || stored.mode === "brief" ? "choose" : (stored.mode ?? "choose"),
    intent: stored.intent ?? "apply_artwork",
    status: stored.status ?? "idle",
    printText: legacy.printText ?? (stored.intent === "text_only" ? legacyPrompt : ""),
    artworkDescription: legacy.artworkDescription ?? "",
    notes: stored.notes ?? (legacyPrompt && legacyPrompt !== legacyDefault ? legacyPrompt : ""),
    quantity: Math.max(1, legacy.quantity ?? Math.min(minimumOrderQuantity, 1)),
    requiredBy: legacy.requiredBy ?? "",
    previews: stored.previews ?? [],
    renderDemo: stored.renderDemo ?? false,
    renderStartedAt: stored.renderStartedAt ?? (stored.previews?.length ? stored.updatedAt : undefined),
  };
}

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
