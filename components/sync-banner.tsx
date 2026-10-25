import { CloudOff, HardDrive, RefreshCw } from "lucide-react";
import type { SyncMode } from "@/lib/use-transactions";

export function SyncBanner({ mode, pending }: { mode: SyncMode; pending: number }) {
  let content: { Icon: typeof CloudOff; text: string; tone: string } | null = null;

  if (mode === "local") {
    content = {
      Icon: HardDrive,
      text: "Mode lokal: database belum terhubung, data tersimpan di perangkat ini.",
      tone: "bg-amber-50 text-amber-800 ring-amber-200",
    };
  } else if (mode === "offline") {
    content = {
      Icon: CloudOff,
      text:
        pending > 0
          ? `Offline: ${pending} perubahan akan disinkronkan saat online.`
          : "Offline: menampilkan data tersimpan terakhir.",
      tone: "bg-slate-100 text-slate-700 ring-slate-200",
    };
  } else if (pending > 0) {
    content = {
      Icon: RefreshCw,
      text: "Menyinkronkan perubahan…",
      tone: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    };
  }

  if (!content) return null;
  const { Icon, text, tone } = content;

  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium ring-1 ${tone}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
