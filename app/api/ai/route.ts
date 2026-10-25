import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey = process.env.CROWN_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI belum dikonfigurasi. Tambahkan CROWN_AI_API_KEY di environment server." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length || messages.length > 24) {
      return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
    }
    const safeMessages = messages.map((m: { role?: string; content?: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 6000),
    }));
    const response = await fetch(`${(process.env.CROWN_AI_BASE_URL || "https://crown.ai.id/v1").replace(/\\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.CROWN_AI_MODEL || "crown",
        messages: [
          { role: "system", content: "Kamu adalah asisten keuangan pribadi di aplikasi Catatduitku. Jawab dalam Bahasa Indonesia, ramah dan ringkas. Bantu membuat anggaran, memahami pemasukan/pengeluaran, dan memberi saran umum. Gunakan hanya data transaksi yang diberikan pengguna; jangan mengarang angka. Kamu bukan penasihat keuangan profesional." },
          ...safeMessages,
        ],
        temperature: 0.6,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message || `Layanan AI merespons ${response.status}. Periksa model dan konfigurasi API.` }, { status: 502 });
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return NextResponse.json({ error: "Respons AI kosong." }, { status: 502 });
    }
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "Tidak dapat menghubungi AI. Coba lagi." }, { status: 500 });
  }
}
