import { supabase, safeSupabaseCall } from "@/lib/supabase";

const DB_NAME = "KKN_Offline_Logbook_DB";
const DB_VERSION = 1;
const STORE_NAME = "logbook_entries";

export interface OfflineLogbookEntry {
  id: string;
  student_id: string;
  group_id?: string | null;
  week_number: number;
  entry_date: string;
  day_name: string;
  time_range: string;
  activity_name: string;
  activity_description: string;
  documentation_url?: string | null;
  status: string;
  dosen_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  sync_status?: "synced" | "pending";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB tidak didukung"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineEntry(entry: OfflineLogbookEntry): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(entry);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Gagal menyimpan ke IndexedDB:", e);
  }
}

export async function getOfflineEntries(studentId: string): Promise<OfflineLogbookEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const all = (request.result as OfflineLogbookEntry[]) || [];
        resolve(all.filter((item) => item.student_id === studentId));
      };
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    console.warn("Gagal membaca dari IndexedDB:", e);
    return [];
  }
}

export async function deleteOfflineEntry(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Gagal menghapus dari IndexedDB:", e);
  }
}

export async function syncPendingEntries(studentId: string): Promise<number> {
  try {
    const offlineItems = await getOfflineEntries(studentId);
    const pendingItems = offlineItems.filter((item) => item.sync_status === "pending");

    if (pendingItems.length === 0) return 0;

    let syncedCount = 0;
    for (const item of pendingItems) {
      const payload = {
        student_id: item.student_id,
        group_id: item.group_id || null,
        week_number: item.week_number,
        entry_date: item.entry_date,
        day_name: item.day_name,
        time_range: item.time_range,
        activity_name: item.activity_name,
        activity_description: item.activity_description,
        documentation_url: item.documentation_url || null,
        status: item.status || "pending",
      };

      const isLocalTempId = item.id.startsWith("local-");

      if (isLocalTempId) {
        let { data: inserted, error: insertErr } = await safeSupabaseCall(async () =>
          supabase.from("kkn_logbook_entries").insert(payload).select()
        );

        if (insertErr && insertErr.code === "23503" && insertErr.message?.includes("group_id")) {
          const { data: retryInserted } = await supabase
            .from("kkn_logbook_entries")
            .insert({ ...payload, group_id: null })
            .select();
          inserted = retryInserted;
        }

        if (inserted && inserted.length > 0) {
          // Hapus temp ID offline dan simpan ID asli dari server
          await deleteOfflineEntry(item.id);
          const serverItem = inserted[0] as OfflineLogbookEntry;
          await saveOfflineEntry({ ...serverItem, sync_status: "synced" });
          syncedCount++;
        }
      } else {
        let { data: updated, error: updateErr } = await safeSupabaseCall(async () =>
          supabase.from("kkn_logbook_entries").update(payload).eq("id", item.id).select()
        );

        if (updateErr && updateErr.code === "23503" && updateErr.message?.includes("group_id")) {
          const { data: retryUpdated } = await supabase
            .from("kkn_logbook_entries")
            .update({ ...payload, group_id: null })
            .eq("id", item.id)
            .select();
          updated = retryUpdated;
        }

        if (updated && updated.length > 0) {
          const serverItem = updated[0] as OfflineLogbookEntry;
          await saveOfflineEntry({ ...serverItem, sync_status: "synced" });
          syncedCount++;
        }
      }
    }

    return syncedCount;
  } catch (e) {
    console.warn("Proses sinkronisasi otomatis IndexedDB gagal:", e);
    return 0;
  }
}
