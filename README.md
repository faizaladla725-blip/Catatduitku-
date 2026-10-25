# Catatduitku

PWA pencatatan keuangan. Next.js (App Router) + Tailwind + Supabase (Auth + Postgres), siap deploy ke Vercel.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Tanpa variabel Supabase, aplikasi berjalan dalam **mode lokal** (tanpa login, data di localStorage
perangkat, banner kuning tampil di dashboard).

## Database dan login (Supabase)

Project Supabase `catatduitku` (ap-southeast-1, ref `rduyzwazzgsvtxfddsst`). Aplikasi bicara langsung
ke Supabase dari browser memakai kunci publishable; keamanan data dijaga **RLS**, bukan kerahasiaan kunci.

Variabel (Vercel Project Settings, Environment Variables):

| Variabel | Isi |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rduyzwazzgsvtxfddsst.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | kunci publishable project |

Skema dan aturan keamanan:

```sql
create table public.transactions (
  id uuid primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  category text not null,
  date date not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;

create policy "owner full access" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

**Pendaftaran terkunci untuk satu pemilik.** Trigger `lock_signup` di `auth.users` menerima akun pertama
(langsung terkonfirmasi, tanpa email verifikasi) dan menolak pendaftaran berikutnya. Untuk menambah
pengguna, hapus trigger lewat SQL Editor: `drop trigger lock_signup on auth.users;`

## PWA

- `app/manifest.ts` → `/manifest.webmanifest` (`display: standalone`, theme `#047857`, ikon 192/512/maskable)
- `public/sw.js` → service worker (aktif hanya di production build): halaman network-first dengan fallback cache, aset statis stale-while-revalidate
- `viewportFit: cover` + `env(safe-area-inset-*)` untuk area notch
- Instal: buka di Chrome/Safari HP → "Add to Home Screen". Service worker butuh HTTPS (otomatis di Vercel).

## Offline & optimistic update

`lib/use-transactions.ts`:

- UI langsung berubah saat tambah/edit/hapus (optimistic), lalu dikirim ke API.
- ID dibuat di client (UUID), sehingga upsert idempoten dan aman dikirim ulang.
- Saat offline atau server error 5xx, perubahan masuk antrean di localStorage dan dikirim berurutan ketika koneksi kembali.
- Jika server menolak (4xx), perubahan dibatalkan dan snackbar tampil.

## Struktur

```
app/            layout, manifest, halaman dashboard
components/     form (bottom sheet), daftar, donut chart, banner sinkronisasi, UI dasar
lib/            hook data, util Rupiah/tanggal, kategori, validasi zod
public/         sw.js dan ikon PWA
```


## Asisten AI Crown

Dashboard kini memiliki tombol **Asisten AI** dengan antarmuka liquid-glass dan konteks ringkasan keuangan bulan aktif.

Atur environment variable di `.env.local` (lokal) atau Vercel Project → Settings → Environment Variables:

- `CROWN_AI_BASE_URL=https://crown.ai.id/v1`
- `CROWN_AI_API_KEY=...` (isi key Crown AI secara rahasia di server)
- `CROWN_AI_MODEL=crown` (ganti jika nama model yang tersedia pada akun berbeda)

Endpoint yang dipanggil adalah `POST /chat/completions` dengan format kompatibel OpenAI. API key hanya dibaca oleh route server `/api/ai`, tidak dikirim ke browser. Setelah mengubah environment variable, restart server atau redeploy. Jika model `crown` tidak tersedia, atur `CROWN_AI_MODEL` ke model yang didukung akun Crown AI.
