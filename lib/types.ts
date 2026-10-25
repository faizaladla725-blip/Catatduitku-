export type TxType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  /** Format YYYY-MM-DD */
  date: string;
  note: string | null;
  createdAt: string;
}

export type TxInput = Omit<Transaction, "id" | "createdAt">;

/** Hasil tebakan dari suara atau foto struk; selalu dicek pengguna sebelum disimpan. */
export interface Draft extends TxInput {
  source: "voice" | "receipt";
  /** Kalimat suara asli atau nama toko, ditampilkan di form */
  hint: string;
  warnings: string[];
  /** Nominal kandidat dari struk, bisa dipilih pengguna */
  candidates?: number[];
  /** Teks mentah hasil OCR, untuk dicek pengguna */
  rawText?: string;
}
