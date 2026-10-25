import { guessCategory } from "./categorize";
import { isValidDate, todayISO, pad } from "./dates";
import type { Draft } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agus: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, nop: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

/** Perbaiki salah baca OCR pada token angka: O->0, l/I->1, S->5 di antara digit. */
function fixDigits(s: string): string {
  return s.replace(/(?<![A-Za-z])[\dOoIl][\dOoIlSs.,]*[\dOoIl](?![A-Za-z])/g, (tok) => {
    if (!/\d/.test(tok)) return tok;
    return tok.replace(/[Oo]/g, "0").replace(/[Il]/g, "1").replace(/(?<=\d)[Ss](?=\d)/g, "5");
  });
}

const MAX_RECEIPT = 100_000_000;

function numbersIn(line: string): number[] {
  const out: number[] = [];
  // "25.000", "25,000", "25.000,00", "Rp 25000", "25 000"
  const re = /\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?(?!\d)|\d{4,9}(?:[.,]\d{1,2})?(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    let s = m[0];
    // buang desimal ",00" di belakang
    if (/[.,]\d{1,2}$/.test(s) && !/[.,]\d{3}$/.test(s)) s = s.replace(/[.,]\d{1,2}$/, "");
    const v = Number(s.replace(/[.,\s]/g, ""));
    if (Number.isFinite(v) && v > 0 && v < MAX_RECEIPT) out.push(v);
  }
  return out;
}

/** Huruf kecil, tanpa tanda baca, dan salah baca label "total" dibereskan. */
function labelForm(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/t\s?[o0]\s?t\s?[a4]\s?[l1i]/g, "total")
    .trim();
}

const SKIP_LINE =
  /sub\s*-?\s*total|total\s*(item|qty|barang|diskon|hemat|potongan|disc)|kembali|change|ppn|pajak|\btax\b|service|diskon|discount|\btunai\b|\bcash\b|npwp|telp|\btel\b|\bhp\b|\bwa\b|\bpoin\b|\bpoint\b/i;

function linePriority(raw: string): number {
  const l = labelForm(raw);
  if (SKIP_LINE.test(l)) return 0;
  if (/grand total|total (bayar|pembayaran|belanja|tagihan|akhir|harga)|jumlah (bayar|tagihan|total)|netto|net total|amount due|total due/.test(l)) return 3;
  if (/\btotal\b|\btotl\b/.test(l)) return 2;
  if (/\b(jumlah|amount|tagihan|harga jual)\b/.test(l)) return 1;
  return 0;
}

export interface TotalResult {
  amount: number;
  fallback: boolean;
  candidates: number[];
}

export function extractTotal(lines: string[]): TotalResult {
  let bestIdx = -1;
  let bestPrio = 0;
  lines.forEach((line, i) => {
    const p = linePriority(line);
    if (p > 0 && p >= bestPrio && (numbersIn(line).length > 0 || numbersIn(lines[i + 1] ?? "").length > 0)) {
      bestPrio = p;
      bestIdx = i;
    }
  });

  const pool = lines
    .filter((l) => !SKIP_LINE.test(labelForm(l)))
    .flatMap(numbersIn)
    .filter((v) => v >= 500 && !(v >= 2020 && v <= 2035));
  const biggest = [...new Set(pool)].sort((a, b) => b - a);

  if (bestIdx >= 0) {
    const same = numbersIn(lines[bestIdx]);
    const nums = same.length > 0 ? same : numbersIn(lines[bestIdx + 1] ?? "");
    const amount = Math.max(...nums);
    return { amount, fallback: false, candidates: [...new Set([amount, ...biggest])].slice(0, 4) };
  }

  // Tanpa label total: tunai dikurangi kembalian = total belanja.
  let paid = 0;
  let change = 0;
  for (const line of lines) {
    const l = labelForm(line);
    if (/\b(tunai|cash|bayar|dibayar)\b/.test(l)) paid = Math.max(paid, ...numbersIn(line), 0);
    if (/\b(kembali|kembalian|change)\b/.test(l)) change = Math.max(change, ...numbersIn(line), 0);
  }
  if (paid > 0 && change > 0 && paid > change) {
    const amount = paid - change;
    return { amount, fallback: true, candidates: [...new Set([amount, ...biggest])].slice(0, 4) };
  }

  if (biggest.length === 0) return { amount: 0, fallback: false, candidates: [] };
  return { amount: biggest[0], fallback: true, candidates: biggest.slice(0, 4) };
}

export function extractReceiptDate(text: string, today = todayISO()): string | null {
  const [ty] = today.split("-").map(Number);
  const ok = (y: number, m: number, d: number) =>
    y >= 2020 && y <= ty + 1 && isValidDate(y, m, d) && `${y}-${pad(m)}-${pad(d)}` <= today;
  const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

  for (const m of text.matchAll(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/g)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (ok(y, mo, d)) return iso(y, mo, d);
  }
  for (const m of text.matchAll(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/g)) {
    let d = Number(m[1]);
    let mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    if (ok(y, mo, d)) return iso(y, mo, d);
  }
  for (const m of text.matchAll(/(\d{1,2})\s*([A-Za-z]{3,9})\.?,?\s*(\d{2,4})/g)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) continue;
    const d = Number(m[1]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (ok(y, mo, d)) return iso(y, mo, d);
  }
  return null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

export function extractMerchant(lines: string[]): string | null {
  for (const raw of lines.slice(0, 8)) {
    const line = raw.trim();
    const letters = (line.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 4 || letters / line.length < 0.5) continue;
    if (/^(struk|receipt|nota|invoice|kasir|tanggal|date|no\b|cashier|terima kasih)/i.test(line)) continue;
    if (/\b(jl\.?|jalan|telp|tel\.|npwp)\b/i.test(line)) continue;
    return titleCase(line.replace(/[^A-Za-z0-9 &'.\-]/g, " ")).slice(0, 40);
  }
  return null;
}

function toLines(ocrText: string): string[] {
  return fixDigits(ocrText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Seberapa meyakinkan teks OCR ini sebuah struk (memilih hasil terbaik dari dua percobaan). */
export function receiptScore(ocrText: string): number {
  const lines = toLines(ocrText);
  const { amount, fallback } = extractTotal(lines);
  let score = Math.min(lines.length, 30);
  if (amount > 0) score += fallback ? 40 : 100;
  if (extractReceiptDate(lines.join("\n"))) score += 15;
  return score;
}

/** Ubah teks hasil OCR struk menjadi draft pengeluaran. */
export function parseReceipt(ocrText: string, today = todayISO()): Draft {
  const lines = toLines(ocrText);
  const text = lines.join("\n");

  const { amount, fallback, candidates } = extractTotal(lines);
  const date = extractReceiptDate(text, today);
  const merchant = extractMerchant(lines);

  const warnings: string[] = [];
  if (lines.length < 3) {
    warnings.push("Hampir tidak ada teks terbaca. Foto lebih dekat, terang, dan tegak lurus, lalu coba lagi.");
  } else if (amount === 0) {
    warnings.push("Total tidak terbaca, isi nominal manual.");
  } else if (fallback) {
    warnings.push("Label total tidak ditemukan. Pilih nominal yang benar di bawah ini.");
  }
  if (!date) warnings.push("Tanggal struk tidak terbaca, memakai hari ini.");

  // Nama toko (baris atas) lebih menentukan daripada daftar barang.
  let category = guessCategory(lines.slice(0, 3).join(" "), "expense");
  if (category === "Lainnya") category = guessCategory(text, "expense");

  return {
    source: "receipt",
    type: "expense",
    amount,
    category,
    date: date ?? today,
    note: merchant ? `Struk ${merchant}` : "Struk belanja",
    hint: merchant ?? "",
    warnings,
    candidates,
    rawText: ocrText.trim().slice(0, 2000),
  };
}
