import type { TxType } from "./types";

interface Rule {
  category: string;
  words: string[];
}

const EXPENSE_RULES: Rule[] = [
  {
    category: "Makanan & Minuman",
    words: [
      "makan", "minum", "kopi", "ngopi", "bakso", "nasi", "ayam", "sate", "mie", "mi ayam", "roti",
      "snack", "jajan", "sarapan", "warung", "resto", "restoran", "cafe", "kafe", "boba",
      "es teh", "gofood", "grabfood", "shopeefood", "martabak", "bakery", "kfc", "mcd",
      "mcdonald", "starbucks", "pizza", "burger", "gorengan", "lauk", "catering", "kantin",
    ],
  },
  {
    category: "Transportasi",
    words: [
      "bensin", "pertalite", "pertamax", "spbu", "pertamina", "parkir", "tol", "ojek", "ojol",
      "gojek", "grab", "maxim", "angkot", "bus", "kereta", "krl", "mrt", "lrt", "transjakarta",
      "taksi", "taxi", "pesawat", "servis motor", "service motor", "oli", "tambal ban",
    ],
  },
  {
    category: "Belanja",
    words: [
      "belanja", "baju", "celana", "sepatu", "tas", "skincare", "kosmetik", "indomaret",
      "alfamart", "alfamidi", "supermarket", "minimarket", "hypermart", "shopee", "tokopedia",
      "lazada", "tiktok shop", "sabun", "shampoo", "deterjen", "sembako", "toko",
    ],
  },
  {
    category: "Tagihan",
    words: [
      "listrik", "pln", "token", "pdam", "air", "internet", "wifi", "indihome", "pulsa",
      "paket data", "kuota", "cicilan", "kos", "kost", "kontrakan", "sewa", "bpjs", "pajak",
      "asuransi", "tagihan", "langganan",
    ],
  },
  {
    category: "Hiburan",
    words: [
      "nonton", "bioskop", "film", "game", "netflix", "spotify", "youtube premium", "konser",
      "wisata", "liburan", "karaoke", "xxi", "cgv", "hiburan", "mancing",
    ],
  },
  {
    category: "Kesehatan",
    words: [
      "obat", "dokter", "klinik", "rumah sakit", "apotek", "apotik", "vitamin", "puskesmas",
      "periksa", "check up", "gigi", "kesehatan", "farmasi", "kimia farma",
    ],
  },
  {
    category: "Pendidikan",
    words: [
      "sekolah", "kuliah", "spp", "ukt", "buku", "kursus", "les", "seminar", "pelatihan",
      "workshop", "kampus", "alat tulis", "fotokopi", "print", "pendidikan",
    ],
  },
];

const INCOME_RULES: Rule[] = [
  { category: "Gaji", words: ["gaji", "salary", "upah", "honor"] },
  { category: "Bonus", words: ["bonus", "thr", "insentif", "komisi", "lembur"] },
  { category: "Hadiah", words: ["hadiah", "kado", "angpao", "angpau", "dikasih", "cashback", "hibah"] },
  {
    category: "Investasi",
    words: ["dividen", "saham", "reksadana", "reksa dana", "bunga bank", "bunga deposito", "crypto", "kripto", "profit", "obligasi"],
  },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Cocokkan kata utuh (kata pendek) atau awalan kata (kata panjang). */
function hasWord(text: string, word: string): boolean {
  const w = escapeRe(word);
  const tail = word.length <= 3 ? "(?:$|[^a-z0-9])" : "";
  return new RegExp(`(?:^|[^a-z0-9])${w}${tail}`).test(text);
}

const STRONG_INCOME =
  /(?:^|[^a-z])(terima|diterima|menerima|dapat|dapet|dikasih|pemasukan|income|cair|transfer masuk|uang masuk|dana masuk)(?:$|[^a-z])/;
const EXPENSE_VERBS =
  /(?:^|[^a-z])(beli|membeli|bayar|membayar|belanja|jajan|traktir|bayarin|topup|top up|cicil|isi)(?:$|[^a-z])/;
const WEAK_INCOME = [
  "gaji", "salary", "upah", "honor", "bonus", "thr", "insentif", "komisi", "hadiah", "kado",
  "angpao", "angpau", "cashback", "dividen", "jualan", "terjual", "untung", "profit", "bayaran",
];

export function detectType(text: string): TxType {
  const t = text.toLowerCase();
  if (STRONG_INCOME.test(t)) return "income";
  if (EXPENSE_VERBS.test(t)) return "expense";
  if (WEAK_INCOME.some((w) => hasWord(t, w))) return "income";
  return "expense";
}

export function guessCategory(text: string, type: TxType): string {
  const t = text.toLowerCase();
  const rules = type === "income" ? INCOME_RULES : EXPENSE_RULES;
  let best = "Lainnya";
  let bestScore = 0;
  for (const rule of rules) {
    const score = rule.words.filter((w) => hasWord(t, w)).length;
    if (score > bestScore) {
      best = rule.category;
      bestScore = score;
    }
  }
  return best;
}
