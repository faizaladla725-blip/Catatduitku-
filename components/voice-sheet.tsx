"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Send, Square } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function errorMessage(code: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "Izin mikrofon ditolak. Aktifkan izin mikrofon untuk situs ini di pengaturan browser.";
    case "no-speech":
      return "Tidak ada suara terdengar. Ketuk mikrofon untuk mencoba lagi.";
    case "audio-capture":
      return "Mikrofon tidak ditemukan.";
    case "network":
      return "Pengenalan suara butuh koneksi internet.";
    default:
      return "Pengenalan suara gagal. Kamu bisa mengetik kalimatnya di bawah.";
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Dipanggil dengan kalimat hasil suara (atau ketikan) untuk diproses */
  onResult: (text: string) => void;
}

const EXAMPLES = ["makan siang dua puluh lima ribu", "gaji lima juta", "bensin 30 ribu kemarin"];

export function VoiceSheet({ open, onClose, onResult }: Props) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recRef = useRef<RecognitionLike | null>(null);
  const textRef = useRef("");
  const autoRef = useRef(true);
  const failedRef = useRef(false);
  const submittedRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const submit = useCallback((value: string) => {
    const v = value.trim();
    if (!v || submittedRef.current) return;
    submittedRef.current = true;
    onResultRef.current(v);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setError(null);
    failedRef.current = false;
    submittedRef.current = false;
    textRef.current = "";
    setText("");

    const rec = new Ctor();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      textRef.current = t;
      setText(t);
    };
    rec.onerror = (e) => {
      const msg = errorMessage(e.error);
      if (msg) {
        failedRef.current = true;
        setError(msg);
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (autoRef.current && !failedRef.current) submit(textRef.current);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Mikrofon tidak bisa dimulai. Coba lagi.");
    }
  }, [submit]);

  // Mulai mendengarkan otomatis saat sheet dibuka; hentikan saat ditutup.
  useEffect(() => {
    if (!open) return;
    autoRef.current = true;
    setSupported(getCtor() !== null);
    setText("");
    textRef.current = "";
    setError(null);
    start();
    return () => {
      autoRef.current = false;
      recRef.current?.abort();
      recRef.current = null;
      setListening(false);
    };
  }, [open, start]);

  function toggleMic() {
    if (listening) recRef.current?.stop();
    else start();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Catat dengan Suara">
      <div className="space-y-4 pb-2">
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            onClick={toggleMic}
            disabled={!supported}
            aria-label={listening ? "Selesai bicara" : "Mulai bicara"}
            className="relative flex h-24 w-24 items-center justify-center rounded-full disabled:opacity-40"
          >
            {listening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
            )}
            <span
              className={cn(
                "relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition",
                listening ? "bg-red-500" : "bg-emerald-600",
              )}
            >
              {listening ? <Square className="h-9 w-9 fill-white" /> : <Mic className="h-10 w-10" />}
            </span>
          </button>
          <p className="text-sm font-medium text-muted-foreground">
            {listening
              ? "Mendengarkan… ketuk lagi jika sudah selesai"
              : supported
                ? "Ketuk mikrofon untuk bicara"
                : "Browser ini belum mendukung suara"}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {!supported && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            Pengenalan suara belum tersedia di browser ini. Ketuk ikon mikrofon di keyboard HP
            untuk dikte, lalu tekan Proses.
          </p>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Kalimat <span className="font-normal text-muted-foreground">(bisa diedit)</span>
          </span>
          <textarea
            rows={2}
            value={text}
            onChange={(e) => {
              textRef.current = e.target.value;
              setText(e.target.value);
            }}
            placeholder="Contoh: makan siang dua puluh lima ribu"
            className="w-full resize-none rounded-lg border border-input bg-background px-3.5 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                textRef.current = ex;
                setText(ex);
              }}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground active:scale-95"
            >
              “{ex}”
            </button>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!text.trim()}
          onClick={() => {
            recRef.current?.abort();
            submit(text);
          }}
        >
          <Send className="h-4 w-4" />
          Proses
        </Button>
      </div>
    </BottomSheet>
  );
}
