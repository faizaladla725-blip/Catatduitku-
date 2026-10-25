import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** false = belum dikonfigurasi, aplikasi berjalan dalam mode lokal tanpa login. */
export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * Kunci publishable aman berada di browser: akses data dibatasi oleh RLS
 * (hanya pemilik baris yang bisa membaca/menulis), bukan oleh kerahasiaan kunci.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

export const CACHE_KEY = "catatduitku:tx:v1";
export const QUEUE_KEY = "catatduitku:queue:v1";
export const MIGRATED_PREFIX = "catatduitku:migrated:";

export function hasLocalCache(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return Boolean(raw && raw !== "[]");
  } catch {
    return false;
  }
}

/** Bersihkan data lokal saat keluar agar tidak tersisa di perangkat bersama. */
export function clearLocalData() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* diabaikan */
  }
}
