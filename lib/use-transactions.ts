"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CACHE_KEY,
  MIGRATED_PREFIX,
  QUEUE_KEY,
  getSupabase,
} from "./supabase";
import type { Transaction, TxInput } from "./types";
import { uuid } from "./utils";

type Op =
  | { kind: "create"; tx: Transaction }
  | { kind: "update"; tx: Transaction }
  | { kind: "delete"; id: string };

type SendResult = "ok" | "offline" | "rejected";

/**
 * server  : tersambung ke Supabase
 * offline : tidak ada koneksi; perubahan masuk antrean dan disinkronkan nanti
 * local   : Supabase belum dikonfigurasi; data hanya di perangkat ini
 */
export type SyncMode = "server" | "offline" | "local";

interface Row {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
  note: string | null;
  created_at: string;
}

function fromRow(r: Row): Transaction {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    category: r.category,
    date: r.date,
    note: r.note,
    createdAt: r.created_at,
  };
}

/** user_id tidak dikirim: database mengisinya otomatis dari akun yang login. */
function toRow(tx: Transaction) {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    date: tx.date,
    note: tx.note,
  };
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage penuh / diblokir: abaikan */
  }
}

function classify(error: { message: string } | null, status: number): SendResult {
  if (!error) return "ok";
  // 0 = permintaan gagal sebelum sampai server (offline); 401 = sesi sedang diperbarui
  if (status === 0 || status === 401 || status >= 500 || /fetch|network/i.test(error.message)) {
    return "offline";
  }
  return "rejected";
}

async function sendOp(sb: SupabaseClient, op: Op): Promise<SendResult> {
  try {
    if (op.kind === "create") {
      // upsert: idempoten, aman dikirim ulang setelah offline
      const { error, status } = await sb
        .from("transactions")
        .upsert(toRow(op.tx), { onConflict: "id" });
      return classify(error, status);
    }
    if (op.kind === "update") {
      const { error, status } = await sb
        .from("transactions")
        .update(toRow(op.tx))
        .eq("id", op.tx.id);
      return classify(error, status);
    }
    const { error, status } = await sb.from("transactions").delete().eq("id", op.id);
    return classify(error, status);
  } catch {
    return "offline";
  }
}

/** Unggah data yang dulu tersimpan lokal (sebelum ada login) satu kali per akun. */
async function migrateLocal(sb: SupabaseClient, uid: string) {
  const flag = `${MIGRATED_PREFIX}${uid}`;
  try {
    if (localStorage.getItem(flag)) return;
  } catch {
    return;
  }
  const cached = readJSON<Transaction[]>(CACHE_KEY, []);
  if (cached.length > 0) {
    for (let i = 0; i < cached.length; i += 200) {
      const chunk = cached.slice(i, i + 200).map(toRow);
      const { error } = await sb.from("transactions").upsert(chunk, { onConflict: "id" });
      if (error) throw error;
    }
  }
  try {
    localStorage.setItem(flag, "1");
  } catch {
    /* diabaikan */
  }
}

export function useTransactions() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setModeState] = useState<SyncMode>("server");
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef<Transaction[]>([]);
  const queueRef = useRef<Op[]>([]);
  const modeRef = useRef<SyncMode>("server");
  const flushingRef = useRef(false);

  const setMode = useCallback((m: SyncMode) => {
    modeRef.current = m;
    setModeState(m);
  }, []);

  const commit = useCallback((next: Transaction[]) => {
    itemsRef.current = next;
    setItems(next);
    writeJSON(CACHE_KEY, next);
  }, []);

  const saveQueue = useCallback((q: Op[]) => {
    queueRef.current = q;
    setPending(q.length);
    writeJSON(QUEUE_KEY, q);
  }, []);

  /** Kirim antrean perubahan offline secara berurutan. */
  const flush = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || flushingRef.current || modeRef.current === "local") return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const result = await sendOp(sb, queueRef.current[0]);
        if (result === "offline") break;
        if (result === "rejected") {
          setError("Satu perubahan ditolak server dan dilewati.");
        }
        saveQueue(queueRef.current.slice(1));
      }
    } finally {
      flushingRef.current = false;
    }
  }, [saveQueue]);

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setMode("local");
      return;
    }

    await flush();
    if (queueRef.current.length > 0) {
      setMode("offline");
      return;
    }

    try {
      const { data: sessionData } = await sb.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        setMode("offline");
        return;
      }

      await migrateLocal(sb, session.user.id);

      const { data, error: fetchError } = await sb
        .from("transactions")
        .select("id,type,amount,category,date,note,created_at")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (fetchError) throw fetchError;

      commit((data as Row[]).map(fromRow));
      setMode("server");
    } catch {
      setMode("offline");
    }
  }, [commit, flush, setMode]);

  // Muat cache lokal lebih dulu (tampil instan), lalu sinkronkan dengan server.
  useEffect(() => {
    const cached = readJSON<Transaction[]>(CACHE_KEY, []);
    itemsRef.current = cached;
    setItems(cached);
    saveQueue(readJSON<Op[]>(QUEUE_KEY, []));
    if (cached.length > 0) setLoading(false);

    refresh().finally(() => setLoading(false));

    const onOnline = () => void refresh();
    const onOffline = () => {
      if (modeRef.current !== "local") setMode("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh, saveQueue, setMode]);

  /** Terapkan perubahan ke UI seketika (optimistic), lalu kirim ke server. */
  const run = useCallback(
    async (op: Op, next: Transaction[]) => {
      const prev = itemsRef.current;
      commit(next);

      const sb = getSupabase();
      if (!sb || modeRef.current === "local") return;

      // Jaga urutan: jika masih ada antrean, ikut antre.
      if (queueRef.current.length > 0) {
        saveQueue([...queueRef.current, op]);
        void flush();
        return;
      }

      const result = await sendOp(sb, op);
      if (result === "ok") return;
      if (result === "offline") {
        saveQueue([...queueRef.current, op]);
        setMode("offline");
        return;
      }
      // rejected: batalkan perubahan optimistic
      commit(prev);
      setError("Gagal menyimpan. Perubahan dibatalkan.");
    },
    [commit, flush, saveQueue, setMode],
  );

  const add = useCallback(
    (input: TxInput) => {
      const tx: Transaction = {
        ...input,
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      return run({ kind: "create", tx }, [tx, ...itemsRef.current]);
    },
    [run],
  );

  const update = useCallback(
    (id: string, input: TxInput) => {
      const current = itemsRef.current.find((t) => t.id === id);
      if (!current) return Promise.resolve();
      const tx: Transaction = { ...current, ...input };
      return run(
        { kind: "update", tx },
        itemsRef.current.map((t) => (t.id === id ? tx : t)),
      );
    },
    [run],
  );

  const remove = useCallback(
    (id: string) =>
      run(
        { kind: "delete", id },
        itemsRef.current.filter((t) => t.id !== id),
      ),
    [run],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { items, loading, mode, pending, error, dismissError, add, update, remove };
}
