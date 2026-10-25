"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Camera,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mic,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { AddMenu } from "@/components/add-menu";
import { AiAssistant } from "@/components/ai-assistant";
import { AuthGate } from "@/components/auth-gate";
import { DonutChart } from "@/components/donut-chart";
import { ReceiptScanner } from "@/components/receipt-scanner";
import { VoiceSheet } from "@/components/voice-sheet";
import { SyncBanner } from "@/components/sync-banner";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { parseVoice } from "@/lib/parse-text";
import type { Draft, Transaction, TxInput } from "@/lib/types";
import { useTransactions } from "@/lib/use-transactions";
import {
  cn,
  currentMonthKey,
  formatRupiah,
  monthKey,
  monthLabel,
  shiftMonth,
} from "@/lib/utils";

export default function Home() {
  return <AuthGate>{({ signOut }) => <Dashboard signOut={signOut} />}</AuthGate>;
}

function Dashboard({ signOut }: { signOut: (() => void) | null }) {
  const { items, loading, mode, pending, error, dismissError, add, update, remove } =
    useTransactions();

  const [month, setMonth] = useState(currentMonthKey());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isCurrentMonth = month === currentMonthKey();

  const stats = useMemo(() => {
    let balance = 0;
    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, number>();
    const monthItems: Transaction[] = [];

    for (const tx of items) {
      balance += tx.type === "income" ? tx.amount : -tx.amount;
      if (monthKey(tx.date) !== month) continue;
      monthItems.push(tx);
      if (tx.type === "income") income += tx.amount;
      else {
        expense += tx.amount;
        byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
      }
    }

    const slices = [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    monthItems.sort((a, b) =>
      a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
    );

    return { balance, income, expense, slices, monthItems };
  }, [items, month]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDraft(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((tx: Transaction) => {
    setEditing(tx);
    setDraft(null);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setDraft(null);
  }, []);

  /** Tampilkan hasil suara/struk di form agar dicek dulu sebelum disimpan */
  const openWithDraft = useCallback((d: Draft) => {
    setEditing(null);
    setDraft(d);
    setFormOpen(true);
  }, []);

  const handleVoiceResult = useCallback(
    (text: string) => {
      setVoiceOpen(false);
      openWithDraft(parseVoice(text));
    },
    [openWithDraft],
  );

  const handleReceiptResult = useCallback(
    (d: Draft) => {
      setScanFile(null);
      openWithDraft(d);
    },
    [openWithDraft],
  );

  const openReceiptPicker = useCallback(() => fileRef.current?.click(), []);

  const handleSubmit = useCallback(
    (input: TxInput) => {
      if (editing) void update(editing.id, input);
      else void add(input);
      // Pindah ke bulan transaksi agar langsung terlihat
      setMonth(monthKey(input.date));
    },
    [add, update, editing],
  );

  return (
    <div className="min-h-dvh">
      {/* Header (aman untuk notch) */}
      <header className="sticky top-0 z-30 bg-gradient-to-br from-emerald-700 to-teal-700 pt-safe text-white shadow-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 pb-3.5 md:max-w-2xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Wallet className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight">Catatduitku</h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button
              onClick={openReceiptPicker}
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/15"
            >
              <Camera className="h-4 w-4" />
              Foto Struk
            </Button>
            <Button
              onClick={() => setVoiceOpen(true)}
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/15"
            >
              <Mic className="h-4 w-4" />
              Suara
            </Button>
            <Button onClick={openAdd} size="sm" className="bg-white text-emerald-800 hover:bg-white/90">
              <Plus className="h-4 w-4" />
              Tambah Transaksi
            </Button>
          </div>
          {signOut && (
            <button
              onClick={() => {
                if (window.confirm("Keluar dari akun? Data tetap aman di server.")) signOut();
              }}
              aria-label="Keluar"
              className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 active:scale-95"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 pb-32 pt-4 md:max-w-2xl md:pb-12">
        <SyncBanner mode={mode} pending={pending} />

        {/* Pemilih bulan */}
        <div className="flex items-center justify-between rounded-2xl bg-card px-2 py-1.5 shadow-sm ring-1 ring-border/60">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bulan sebelumnya"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-bold capitalize">{monthLabel(month)}</p>
            {!isCurrentMonth && (
              <button
                onClick={() => setMonth(currentMonthKey())}
                className="text-xs font-semibold text-primary"
              >
                Kembali ke bulan ini
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bulan berikutnya"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Kartu ringkasan */}
        <section aria-label="Ringkasan" className="space-y-3">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-900/10">
            <p className="text-sm font-medium text-white/80">Sisa Saldo</p>
            <p
              className={cn(
                "mt-1 text-3xl font-extrabold tabular-nums tracking-tight",
                loading && "opacity-60",
              )}
            >
              {formatRupiah(stats.balance)}
            </p>
            <p className="mt-1 text-xs text-white/70">Akumulasi seluruh transaksi</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <ArrowDownCircle className="h-4 w-4" />
                Pemasukan {isCurrentMonth ? "Bulan Ini" : ""}
              </div>
              <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-emerald-600">
                {formatRupiah(stats.income)}
              </p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                <ArrowUpCircle className="h-4 w-4" />
                Pengeluaran {isCurrentMonth ? "Bulan Ini" : ""}
              </div>
              <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-red-600">
                {formatRupiah(stats.expense)}
              </p>
            </div>
          </div>
        </section>

        {/* Grafik */}
        <section
          aria-label="Persentase pengeluaran"
          className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border/60"
        >
          <h2 className="mb-4 font-bold">Persentase Pengeluaran</h2>
          {stats.expense > 0 ? (
            <DonutChart data={stats.slices} total={stats.expense} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada pengeluaran di bulan ini.
            </p>
          )}
        </section>

        {/* Daftar transaksi */}
        <section aria-label="Transaksi terbaru">
          <h2 className="mb-3 px-1 font-bold">Transaksi Terbaru</h2>
          <TransactionList
            items={stats.monthItems}
            loading={loading}
            onEdit={openEdit}
            onDelete={(id) => void remove(id)}
          />
        </section>
      </main>

      <AiAssistant context={`Bulan: ${monthLabel(month)}. Saldo saat ini: ${formatRupiah(stats.balance)}. Pemasukan bulan terpilih: ${formatRupiah(stats.income)}. Pengeluaran bulan terpilih: ${formatRupiah(stats.expense)}. Pengeluaran berdasarkan kategori: ${stats.slices.map((x) => `${x.category}: ${formatRupiah(x.amount)}`).join(", ") || "belum ada data"}. Jumlah transaksi bulan terpilih: ${stats.monthItems.length}.`} />\n\n      {/* FAB (mobile): ketik, suara, atau foto struk */}
      <AddMenu
        onManual={openAdd}
        onVoice={() => setVoiceOpen(true)}
        onReceipt={openReceiptPicker}
      />

      {/* capture="environment" membuka kamera belakang di HP; di desktop jadi pilih file */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setScanFile(f);
        }}
      />

      <VoiceSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} onResult={handleVoiceResult} />

      <ReceiptScanner
        file={scanFile}
        onClose={() => setScanFile(null)}
        onResult={handleReceiptResult}
        onManual={() => {
          setScanFile(null);
          openAdd();
        }}
      />

      <TransactionForm
        open={formOpen}
        onClose={closeForm}
        editing={editing}
        draft={draft}
        onSubmit={handleSubmit}
      />

      {/* Snackbar error */}
      {error && (
        <div
          role="alert"
          className="fixed inset-x-4 z-[60] mx-auto flex max-w-md animate-pop-in items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-2xl"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          <span className="flex-1">{error}</span>
          <button onClick={dismissError} aria-label="Tutup pesan" className="opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
