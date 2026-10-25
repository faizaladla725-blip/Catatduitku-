"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { parseReceipt, receiptScore } from "@/lib/parse-receipt";
import type { Draft } from "@/lib/types";

interface Props {
  /** Foto struk; null = sheet tertutup */
  file: File | null;
  onClose: () => void;
  onResult: (draft: Draft) => void;
  /** Lewati pemindaian dan isi form manual */
  onManual: () => void;
}

interface Prepared {
  /** Hitam-putih adaptif: tahan bayangan dan pencahayaan tidak rata */
  bw: HTMLCanvasElement;
  /** Abu-abu dengan kontras diregangkan */
  gray: HTMLCanvasElement;
}

function canvasFrom(w: number, h: number, data: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  const img = ctx.createImageData(w, h);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Siapkan dua versi gambar untuk OCR. Foto HP sering terlalu besar (lambat) atau
 * terlalu kecil/bayangan (tidak terbaca), jadi ukuran dinormalkan ke ~2000 px
 * lalu dibuat versi binarisasi adaptif (Bradley) selain versi abu-abu biasa.
 */
async function prepareImages(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
    createImageBitmap(file),
  );
  const target = 2000;
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(2, target / longest);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas tidak tersedia");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const px = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const gray = new Uint8Array(n);
  let lo = 255;
  let hi = 0;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    gray[p] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }

  // Versi abu-abu dengan kontras diregangkan
  const range = Math.max(1, hi - lo);
  const grayRGBA = new Uint8ClampedArray(n * 4);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const v = ((gray[p] - lo) * 255) / range;
    grayRGBA[i] = grayRGBA[i + 1] = grayRGBA[i + 2] = v;
    grayRGBA[i + 3] = 255;
  }

  // Integral image untuk rata-rata lokal
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  const half = Math.max(8, Math.round(Math.min(w, h) / 24));
  const bwRGBA = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(w - 1, x + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];
      const v = gray[y * w + x] * count < sum * 0.85 ? 0 : 255;
      const i = (y * w + x) * 4;
      bwRGBA[i] = bwRGBA[i + 1] = bwRGBA[i + 2] = v;
      bwRGBA[i + 3] = 255;
    }
  }

  return { bw: canvasFrom(w, h, bwRGBA), gray: canvasFrom(w, h, grayRGBA) };
}

type Worker = {
  recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  setParameters: (params: never) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

export function ReceiptScanner({ file, onClose, onResult, onManual }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("Menyiapkan foto…");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    let worker: Worker | null = null;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setError(null);
    setProgress(0);
    setStatus("Menyiapkan foto…");

    (async () => {
      try {
        const { bw, gray } = await prepareImages(file);
        if (cancelled) return;

        setStatus("Menyiapkan pembaca teks (pertama kali agak lama)…");
        const { createWorker } = await import("tesseract.js");
        const w = (await createWorker("eng", 1, {
          logger: (m) => {
            if (cancelled) return;
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        })) as unknown as Worker;
        worker = w;
        if (cancelled) {
          await w.terminate();
          return;
        }

        // Percobaan 1: hitam-putih adaptif, satu kolom teks
        setStatus("Membaca struk…");
        await w.setParameters({
          tessedit_pageseg_mode: "4",
          preserve_interword_spaces: "1",
        } as never);
        const first = (await w.recognize(bw)).data.text;
        if (cancelled) return;

        let best = first;
        // Percobaan 2 hanya jika total belum ketemu: abu-abu, satu blok teks
        if (receiptScore(first) < 100) {
          setProgress(0);
          setStatus("Mencoba mode baca lain…");
          await w.setParameters({
            tessedit_pageseg_mode: "6",
            preserve_interword_spaces: "1",
          } as never);
          const second = (await w.recognize(gray)).data.text;
          if (cancelled) return;
          if (receiptScore(second) > receiptScore(first)) best = second;
        }

        await w.terminate();
        worker = null;
        if (cancelled) return;

        onResultRef.current(parseReceipt(best));
      } catch (err) {
        console.error("Scan struk gagal", err);
        if (!cancelled) {
          setError(
            "Gagal membaca struk. Pastikan internet aktif saat pertama kali memindai (pembaca teks diunduh sekali), lalu coba lagi.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
      worker?.terminate().catch(() => {});
    };
  }, [file, attempt]);

  return (
    <BottomSheet open={file !== null} onClose={onClose} title="Memindai Struk">
      <div className="space-y-4 pb-2">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Foto struk"
            className="mx-auto max-h-64 w-auto rounded-xl object-contain ring-1 ring-border"
          />
        )}

        {error ? (
          <>
            <div
              role="alert"
              className="flex gap-2.5 rounded-xl bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                Coba lagi
              </Button>
              <Button onClick={onManual}>Isi manual</Button>
            </div>
          </>
        ) : (
          <div className="space-y-2.5" aria-live="polite">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{status}</span>
              {progress > 0 && (
                <span className="ml-auto tabular-nums text-muted-foreground">{progress}%</span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(progress, 6)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Foto diproses di perangkatmu dan tidak diunggah ke server.
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
