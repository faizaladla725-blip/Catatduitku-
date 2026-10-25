import type { TxType } from "./types";

export const EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Tagihan",
  "Hiburan",
  "Kesehatan",
  "Pendidikan",
  "Lainnya",
] as const;

export const INCOME_CATEGORIES = [
  "Gaji",
  "Bonus",
  "Hadiah",
  "Investasi",
  "Lainnya",
] as const;

export function categoriesFor(type: TxType): readonly string[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export const CATEGORY_COLORS: Record<string, string> = {
  "Makanan & Minuman": "#f97316",
  Transportasi: "#3b82f6",
  Belanja: "#ec4899",
  Tagihan: "#eab308",
  Hiburan: "#8b5cf6",
  Kesehatan: "#ef4444",
  Pendidikan: "#06b6d4",
  Lainnya: "#64748b",
  Gaji: "#10b981",
  Bonus: "#14b8a6",
  Hadiah: "#f43f5e",
  Investasi: "#6366f1",
};

export function colorFor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#64748b";
}
