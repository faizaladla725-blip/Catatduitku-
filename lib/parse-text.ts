import { addDays, todayISO, toISO } from "./dates";
import { detectType, guessCategory } from "./categorize";
import type { Draft } from "./types";

const DIGIT_WORDS: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
};

/** Kata yang langsung bernilai tetap (termasuk slang uang). */
const FIXED_WORDS: Record<string, number> = {
  sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1_000, sejuta: 1_000_000,
  gopek: 500, seceng: 1_000, goceng: 5_000, ceban: 10_000, goban: 20_000, gocap: 50_000, cepek: 100_000,
};

const QUANTITY_NOUNS = new Set([
  "hari", "orang", "porsi", "kali", "buah", "bungkus", "biji", "gelas", "piring", "jam",
  "menit", "minggu", "bulan", "tahun", "kg", "liter", "botol", "potong", "bulanan",
]);

/**
 * Ubah deretan kata bilangan Indonesia menjadi angka.
 * "dua puluh lima ribu" -> 25000, "satu setengah juta" -> 1500000.
 * Mengembalikan nilai tiap deretan bilangan yang ditemukan.
 */
export function wordRuns(words: string[]): number[] {
  const runs: number[] = [];
  let inRun = false;
  let total = 0;
  let chunk = 0;
  let pending = 0;

  const flush = () => {
    if (inRun) {
      const v = total + chunk + pending;
      if (v > 0) runs.push(v);
    }
    inRun = false;
    total = 0;
    chunk = 0;
    pending = 0;
  };

  const mult = (unit: number) => {
    const m = chunk + pending || 1;
    total += m * unit;
    chunk = 0;
    pending = 0;
  };

  for (const w of words) {
    if (w in DIGIT_WORDS) {
      if (inRun && pending > 0) flush();
      inRun = true;
      pending = DIGIT_WORDS[w];
    } else if (w in FIXED_WORDS) {
      const v = FIXED_WORDS[w];
      inRun = true;
      if (v >= 1000) total += v;
      else chunk += v;
    } else if (w === "belas" && inRun) {
      chunk += pending + 10;
      pending = 0;
    } else if (w === "puluh" && inRun) {
      chunk += (pending || 1) * 10;
      pending = 0;
    } else if (w === "ratus" && inRun) {
      chunk += (pending || 1) * 100;
      pending = 0;
    } else if (w === "ribu" && inRun) {
      mult(1_000);
    } else if (w === "juta" && inRun) {
      mult(1_000_000);
    } else if (w === "setengah") {
      inRun = true;
      pending += 0.5;
    } else if (w === "rupiah" || w === "rp" || w === "perak" || w === "dan") {
      // tidak memutus deretan
    } else {
      // "lima puluh ribu tiga hari lalu": angka sisa di depan kata satuan adalah jumlah, bukan uang
      if (pending > 0 && chunk === 0 && total > 0 && QUANTITY_NOUNS.has(w)) pending = 0;
      flush();
    }
  }
  flush();
  return runs;
}

const SUFFIX: Record<string, number> = {
  ribu: 1_000, rb: 1_000, k: 1_000, juta: 1_000_000, jt: 1_000_000,
};

interface Candidate {
  value: number;
  explicit: boolean; // ada satuan (ribu/juta/Rp) sehingga jelas itu uang
}

function digitCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /(rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(ribu|rb|juta|jt|k)?(?![a-z0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const hasRp = Boolean(m[1]);
    const raw = m[2];
    const suffix = m[3];
    const grouped = /^\d{1,3}([.,]\d{3})+$/.test(raw);
    let value: number;
    if (suffix) {
      const base = grouped ? Number(raw.replace(/[.,]/g, "")) : parseFloat(raw.replace(",", "."));
      value = Math.round(base * SUFFIX[suffix]);
    } else if (grouped) {
      value = Number(raw.replace(/[.,]/g, ""));
    } else if (/^\d+[.,]\d{1,2}$/.test(raw)) {
      value = Math.round(parseFloat(raw.replace(",", ".")));
    } else {
      value = Number(raw);
    }
    if (Number.isFinite(value) && value > 0) {
      out.push({ value, explicit: Boolean(suffix) || hasRp || grouped });
    }
  }
  return out;
}

export function extractAmount(text: string): { amount: number; assumedThousands: boolean } {
  const t = text.toLowerCase();
  const words = t.split(/[^a-z]+/).filter(Boolean);
  const candidates: Candidate[] = [
    ...digitCandidates(t),
    ...wordRuns(words).map((value) => ({ value, explicit: value >= 1000 })),
  ];
  if (candidates.length === 0) return { amount: 0, assumedThousands: false };

  const big = candidates.filter((c) => c.value >= 500);
  if (big.length > 0) {
    return { amount: Math.round(Math.max(...big.map((c) => c.value))), assumedThousands: false };
  }
  // Angka kecil tanpa satuan ("bakso 15") biasanya berarti ribuan.
  const best = Math.max(...candidates.map((c) => c.value));
  return { amount: Math.round(best * 1000), assumedThousands: true };
}

const NUM_DAYS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7,
};

export function extractDate(text: string, today = todayISO()): string {
  const t = text.toLowerCase();
  if (/kemarin lusa|lusa kemarin/.test(t)) return addDays(today, -2);
  if (/\bkemarin\b/.test(t)) return addDays(today, -1);
  if (/minggu lalu|seminggu lalu/.test(t)) return addDays(today, -7);

  const nDigits = t.match(/(\d+)\s*hari\s*(?:yang\s*)?lalu/);
  if (nDigits) return addDays(today, -Math.min(Number(nDigits[1]), 365));
  const nWords = t.match(/\b(satu|dua|tiga|empat|lima|enam|tujuh)\s*hari\s*(?:yang\s*)?lalu/);
  if (nWords) return addDays(today, -NUM_DAYS[nWords[1]]);

  const tgl = t.match(/tanggal\s*(\d{1,2})\b/);
  if (tgl) {
    const day = Number(tgl[1]);
    const [y, m, d] = today.split("-").map(Number);
    if (day >= 1 && day <= 31) {
      // Tanggal yang belum terjadi bulan ini dianggap bulan lalu.
      const target = day > d ? new Date(y, m - 2, day) : new Date(y, m - 1, day);
      if (target.getDate() === day) return toISO(target);
    }
  }
  return today;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ubah kalimat suara ("makan siang dua puluh lima ribu") menjadi draft transaksi. */
export function parseVoice(transcript: string, today = todayISO()): Draft {
  const text = transcript.trim();
  const type = detectType(text);
  const { amount, assumedThousands } = extractAmount(text);
  const warnings: string[] = [];
  if (amount === 0) warnings.push("Nominal tidak terdeteksi, isi manual.");
  if (assumedThousands) warnings.push("Nominal dianggap dalam ribuan. Periksa lagi.");

  return {
    source: "voice",
    type,
    amount,
    category: guessCategory(text, type),
    date: extractDate(text, today),
    note: text ? capitalize(text).slice(0, 200) : null,
    hint: text,
    warnings,
  };
}
