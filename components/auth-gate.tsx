"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearLocalData, getSupabase, hasLocalCache } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Api {
  /** null = mode lokal (Supabase belum dikonfigurasi), tidak ada akun */
  signOut: (() => void) | null;
  email: string | null;
}

const fieldClass =
  "h-12 w-full rounded-lg border border-input bg-background px-3.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function friendlyError(message: string, mode: "login" | "signup"): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email atau password salah.";
  if (m.includes("database error") || m.includes("pendaftaran ditutup")) {
    return "Pendaftaran ditutup: aplikasi ini sudah punya pemilik. Silakan masuk.";
  }
  if (m.includes("already registered")) return "Email sudah terdaftar. Silakan masuk.";
  if (m.includes("password")) return "Password minimal 6 karakter.";
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Tidak ada koneksi internet. Coba lagi saat online.";
  }
  if (m.includes("rate limit")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  return mode === "login" ? "Gagal masuk. Coba lagi." : "Gagal mendaftar. Coba lagi.";
}

export function AuthGate({ children }: { children: (api: Api) => React.ReactNode }) {
  const supabase = getSupabase();
  const [status, setStatus] = useState<"loading" | "in" | "out">(supabase ? "loading" : "in");
  const [email, setEmail] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<"login" | "signup">("login");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (data.session) {
          setEmail(data.session.user.email ?? null);
          setStatus("in");
        } else if (!navigator.onLine && hasLocalCache()) {
          // Offline dengan data tersimpan: tetap bisa dipakai
          setStatus("in");
        } else {
          setStatus("out");
        }
      })
      .catch(() => {
        if (active) setStatus(hasLocalCache() ? "in" : "out");
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setEmail(session.user.email ?? null);
        setStatus("in");
      } else if (event === "SIGNED_OUT") {
        setStatus("out");
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(() => {
    clearLocalData();
    void supabase?.auth.signOut();
    setEmail(null);
    setStatus("out");
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);

    const creds = { email: emailInput.trim(), password };

    if (formMode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp(creds);
      if (signUpError) {
        setBusy(false);
        setError(friendlyError(signUpError.message, "signup"));
        return;
      }
    }

    // Akun pemilik langsung terkonfirmasi, jadi cukup masuk setelah daftar.
    const { error: signInError } = await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (signInError) setError(friendlyError(signInError.message, "login"));
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Memuat" />
      </div>
    );
  }

  if (status === "in") {
    return <>{children({ signOut: supabase ? signOut : null, email })}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10 pt-safe">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/20">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Catatduitku</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formMode === "login"
                ? "Masuk untuk melihat catatan keuanganmu."
                : "Buat akun pemilik. Hanya satu akun yang diizinkan."}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border/60"
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className={fieldClass}
              placeholder="nama@email.com"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete={formMode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="Minimal 6 karakter"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {formMode === "login" ? "Masuk" : "Daftar dan Masuk"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setFormMode((m) => (m === "login" ? "signup" : "login"));
            setError(null);
          }}
          className={cn("w-full text-center text-sm font-semibold text-primary")}
        >
          {formMode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
      </div>
    </div>
  );
}
