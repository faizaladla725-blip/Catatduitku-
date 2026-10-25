"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles, X, LoaderCircle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export function AiAssistant({ context }: { context: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [
          { role: "user", content: `Konteks ringkasan keuangan pengguna (Rupiah):\\n${context}\\n\\nPertanyaan: ${content}` },
          ...next.slice(0, -1),
        ] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Permintaan AI gagal.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return <>
    <button onClick={() => setOpen(true)} aria-label="Buka asisten AI" className="ai-fab">
      <Sparkles className="h-5 w-5" /><span>Asisten AI</span>
    </button>
    {open && <div className="ai-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="ai-panel" role="dialog" aria-modal="true" aria-labelledby="ai-title">
        <header className="ai-head">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700"><Bot className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><h2 id="ai-title" className="font-bold">Asisten Keuangan AI</h2><p className="text-xs text-slate-500">Didukung Crown AI · Catatduitku</p></div>
          <button className="ai-close" onClick={() => setOpen(false)} aria-label="Tutup"><X className="h-5 w-5" /></button>
        </header>
        <div className="ai-messages">
          {messages.length === 0 && <div className="my-auto text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-700"><Sparkles className="h-7 w-7" /></div>
            <h3 className="font-bold">Hai! Ada yang bisa kubantu?</h3>
            <p className="mt-1 text-sm text-slate-500">Tanya soal anggaran, pengeluaran, atau cara menabung.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {["Analisis pengeluaranku", "Bantu buat anggaran", "Tips menabung"].map((q) => <button key={q} className="ai-suggestion" onClick={() => void send(q)}>{q}</button>)}
            </div>
          </div>}
          {messages.map((m, i) => <div key={i} className={`ai-bubble ${m.role === "user" ? "ai-user" : "ai-answer"}`}>{m.content}</div>)}
          {busy && <div className="ai-bubble ai-answer flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Sedang berpikir…</div>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <form className="ai-compose" onSubmit={submit}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tulis pertanyaan..." aria-label="Pesan untuk AI" disabled={busy} />
          <button type="submit" aria-label="Kirim pesan" disabled={busy || !input.trim()}><Send className="h-4 w-4" /></button>
        </form>
        <p className="px-4 pb-3 text-center text-[10px] text-slate-500">Periksa kembali saran AI sebelum mengambil keputusan keuangan.</p>
      </section>
    </div>}
  </>;
}
