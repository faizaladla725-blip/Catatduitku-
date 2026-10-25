"use client";

import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Camera, Mic, TriangleAlert } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { categoriesFor } from "@/lib/categories";
import type { Draft, Transaction, TxInput, TxType } from "@/lib/types";
import { cn, formatDigits, parseDigits, todayISO } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Jika diisi, form berada dalam mode edit */
  editing: Transaction | null;
  /** Hasil tebakan suara/struk untuk mengisi form otomatis */
  draft: Draft | null;
  onSubmit: (input: TxInput) => void;
}

const fieldClass =
  "h-12 w-full rounded-lg border border-input bg-background px-3.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function TransactionForm({ open, onClose, editing, draft, onSubmit }: Props) {
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset / isi ulang setiap form dibuka
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setType(editing.type);
      setAmount(formatDigits(String(editing.amount)));
      setCategory(editing.category);
      setDate(editing.date);
      setNote(editing.note ?? "");
    } else if (draft) {
      setType(draft.type);
      setAmount(draft.amount > 0 ? formatDigits(String(draft.amount)) : "");
      setCategory(draft.category);
      setDate(draft.date);
      setNote(draft.note ?? "");
    } else {
      setType("expense");
      setAmount("");
      setCategory(categoriesFor("expense")[0]);
      setDate(todayISO());
      setNote("");
    }
  }, [open, editing, draft]);

  function switchType(next: TxType) {
    setType(next);
    if (!categoriesFor(next).includes(category)) setCategory(categoriesFor(next)[0]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseDigits(amount);
    if (value <= 0) return setError("Nominal harus lebih dari 0.");
    if (!date) return setError("Pilih tanggal transaksi.");
    onSubmit({
      type,
      amount: value,
      category: category || categoriesFor(type)[0],
      date,
      note: note.trim() ? note.trim() : null,
    });
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit Transaksi" : "Tambah Transaksi"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-2">
        {draft && !editing && (
          <div className="space-y-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
            <div className="flex items-start gap-2">
              {draft.source === "voice" ? (
                <Mic className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Camera className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p className="font-medium">
                {draft.source === "voice"
                  ? `Terisi dari suara: “${draft.hint}”`
                  : "Terisi dari foto struk. Periksa lagi sebelum menyimpan."}
              </p>
            </div>
            {draft.warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 text-amber-800">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {w}
              </p>
            ))}
            {draft.candidates && draft.candidates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium">Nominal terbaca:</span>
                {draft.candidates.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAmount(formatDigits(String(c)))}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-emerald-300 active:scale-95"
                  >
                    {formatDigits(String(c))}
                  </button>
                ))}
              </div>
            )}
            {draft.rawText && (
              <details className="text-xs text-emerald-900/80">
                <summary className="cursor-pointer font-medium">Lihat teks yang terbaca</summary>
                <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 font-mono">
                  {draft.rawText}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Tipe */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-1.5">
          {(
            [
              { value: "expense", label: "Pengeluaran", Icon: ArrowUpCircle, active: "text-red-600" },
              { value: "income", label: "Pemasukan", Icon: ArrowDownCircle, active: "text-emerald-600" },
            ] as const
          ).map(({ value, label, Icon, active }) => (
            <button
              key={value}
              type="button"
              onClick={() => switchType(value)}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition",
                type === value
                  ? cn("bg-card shadow-sm", active)
                  : "text-muted-foreground",
              )}
              aria-pressed={type === value}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Nominal */}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nominal</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">
              Rp
            </span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(formatDigits(e.target.value))}
              className={cn(fieldClass, "pl-11 text-lg font-bold tabular-nums")}
              autoFocus={!editing}
            />
          </div>
        </label>

        {/* Kategori */}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Kategori</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={cn(fieldClass, "appearance-none bg-[length:1.1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10")}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            }}
          >
            {categoriesFor(type).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Tanggal */}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Tanggal</span>
          <input
            type="date"
            value={date}
            max="2999-12-31"
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </label>

        {/* Catatan */}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </span>
          <input
            type="text"
            value={note}
            maxLength={500}
            placeholder="Contoh: makan siang bareng tim"
            onChange={(e) => setNote(e.target.value)}
            className={fieldClass}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full">
          {editing ? "Simpan Perubahan" : "Simpan Transaksi"}
        </Button>
      </form>
    </BottomSheet>
  );
}
