"use client";

import { useState } from "react";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorFor } from "@/lib/categories";
import type { Transaction } from "@/lib/types";
import { cn, formatDateShort, formatRupiah } from "@/lib/utils";

interface Props {
  items: Transaction[];
  loading: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

export function TransactionList({ items, loading, onEdit, onDelete }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (loading) {
    return (
      <ul className="space-y-2.5" aria-busy="true" aria-label="Memuat transaksi">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex animate-pulse items-center gap-3 rounded-2xl bg-card p-3.5">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
            <div className="h-4 w-16 rounded bg-muted" />
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-input bg-card/60 px-6 py-10 text-center">
        <Receipt className="h-9 w-9 text-muted-foreground/60" />
        <p className="font-semibold">Belum ada transaksi</p>
        <p className="text-sm text-muted-foreground">
          Ketuk tombol + untuk mencatat pemasukan atau pengeluaran pertamamu.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((tx) => {
        const isIncome = tx.type === "income";
        const confirming = confirmId === tx.id;
        return (
          <li
            key={tx.id}
            className="animate-pop-in rounded-2xl bg-card p-3.5 shadow-sm ring-1 ring-border/60"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: colorFor(tx.category) }}
                aria-hidden
              >
                {tx.category.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{tx.category}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDateShort(tx.date)}
                  {tx.note ? ` · ${tx.note}` : ""}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 text-sm font-bold tabular-nums",
                  isIncome ? "text-emerald-600" : "text-red-600",
                )}
              >
                {isIncome ? "+" : "−"}
                {formatRupiah(tx.amount)}
              </p>
            </div>

            <div className="mt-2.5 flex items-center justify-end gap-1.5">
              {confirming ? (
                <>
                  <span className="mr-auto text-xs font-medium text-muted-foreground">
                    Hapus transaksi ini?
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setConfirmId(null);
                      onDelete(tx.id);
                    }}
                  >
                    Hapus
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(tx)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmId(tx.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
