"use client";

import { useState } from "react";
import { Camera, Mic, PenLine, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onManual: () => void;
  onVoice: () => void;
  onReceipt: () => void;
}

/** FAB mobile yang membuka tiga cara mencatat: ketik, suara, foto struk. */
export function AddMenu({ onManual, onVoice, onReceipt }: Props) {
  const [open, setOpen] = useState(false);

  const items = [
    { label: "Foto Struk", Icon: Camera, action: onReceipt, tone: "bg-sky-600" },
    { label: "Suara", Icon: Mic, action: onVoice, tone: "bg-violet-600" },
    { label: "Ketik", Icon: PenLine, action: onManual, tone: "bg-slate-700" },
  ];

  return (
    <div className="md:hidden">
      {open && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <div
        className="fixed right-5 z-40 flex flex-col items-end gap-3"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        {open &&
          items.map(({ label, Icon, action, tone }) => (
            <button
              key={label}
              onClick={() => {
                setOpen(false);
                action();
              }}
              className="flex animate-pop-in items-center gap-3 active:scale-95"
            >
              <span className="rounded-lg bg-card px-3 py-1.5 text-sm font-semibold shadow-md">
                {label}
              </span>
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg",
                  tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            </button>
          ))}

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Tambah Transaksi"}
          aria-expanded={open}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-900/30 transition active:scale-90"
        >
          <Plus
            className={cn("h-7 w-7 transition-transform duration-200", open && "rotate-45")}
            strokeWidth={2.75}
          />
        </button>
      </div>
    </div>
  );
}
