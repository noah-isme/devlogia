# 🧠 Devlogia — Personal Blog CMS by Noah

> “Where logic meets narrative.”  
> A modern, developer-centric personal blog CMS — fast, minimal, and built for deep writing.

---

<p align="center">
  <img src="https://dummyimage.com/1200x300/1f2937/ffffff&text=Devlogia+—+Personal+Blog+CMS" alt="Devlogia Banner"/>
</p>

<p align="center">
  <a href="https://github.com/noah-isme/devlogia/actions">
    <img src="https://github.com/noah-isme/devlogia/actions/workflows/ci.yml/badge.svg" alt="Build Status"/>
  </a>
  <a href="https://github.com/noah-isme/devlogia/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"/>
  </a>
  <img src="https://img.shields.io/badge/Node.js-v20.x-brightgreen.svg" alt="Node.js Version"/>
  <img src="https://img.shields.io/badge/Next.js-16-black.svg" alt="Next.js Version"/>
</p>

---

## ✨ Overview

**Devlogia** adalah blog CMS pribadi untuk kreator dan developer yang ingin menulis tanpa hambatan teknis.  
Dirancang dengan fokus pada:
- kecepatan (SSG/ISR),
- pengalaman menulis modern (MDX + autosave editor),
- SEO dan performa maksimal,
- arsitektur bersih (Next.js + PostgreSQL + Prisma).

Kamu dapat mengelola artikel, halaman statis, media, dan SEO langsung dari dashboard admin — ringan, indah, dan efisien.

---

## 🏗️ Tech Stack

| Layer | Teknologi | Deskripsi |
|-------|------------|-----------|
| Frontend | **Next.js 16 (App Router)** | Rendering hybrid SSG/ISR, MDX rendering |
| Backend | **Node.js / Express API (in-app)** | CRUD posts, pages, uploads, auth |
| Database | **PostgreSQL** (via Prisma ORM) | Data terstruktur dan relasi fleksibel |
| Auth | **NextAuth.js** | Email/password, session JWT |
| Upload | **UploadThing / Cloudflare R2** | Media upload & optimization |
| Styling | **Tailwind CSS** | Utility-first design, dark/light mode |
| Editor | **MDX + React Components** | Markdown interaktif dengan Callouts, YouTube, dsb |
| Deployment | **Vercel + Railway (DB)** | Auto CI/CD + scalable infra |
| Testing | **Vitest / Playwright** | Unit & E2E testing |
| CI/CD | **GitHub Actions** | Lint, typecheck, test, Lighthouse budget |

---

## 🧩 Fitur Utama (MVP)

✅ Auth admin (login, logout, session)  
✅ CRUD Posts & Pages  
✅ MDX Editor dengan autosave  
✅ Upload media (gambar/video)  
✅ Tag & kategori sistem  
✅ Pencarian full-text (Postgres tsvector)  
✅ SEO otomatis (meta, OG, sitemap, RSS)  
✅ Mode gelap & ringan  
✅ Code highlight (Shiki/Prism)  
✅ Deploy cepat ke Vercel/Railway  

---

## 🚀 Rencana Pengembangan

### Phase 1 — MVP (✅ Sedang dikerjakan)
- Struktur proyek + Prisma schema
- Auth admin & dashboard awal
- Editor MDX dasar + autosave
- CRUD posts/pages
- SEO helper, sitemap, RSS

### Phase 2 — Polishing
- Schedule & draft preview
- OG image generator
- Analytics (Plausible/Umami)
- Newsletter (Buttondown/Resend)
- Komentar via Utterances

### Phase 3 — Ekosistem
- Multi-author + RBAC
- Webhook revalidate + incremental builds
- AI assist (generate meta/tagging)

---

## 🗂️ Struktur Proyek

```
devlogia/
├── prisma/
│   ├── schema.prisma        # Skema database
│   └── seed.ts              # Data awal
├── src/
│   ├── app/
│   │   ├── (public)/        # Halaman publik (blog, about)
│   │   ├── (admin)/         # Dashboard admin
│   │   └── api/             # API routes
│   ├── components/          # UI components
│   ├── lib/                 # Utils (auth, prisma, seo, upload)
│   ├── mdx-components/      # Komponen interaktif untuk MDX
│   └── styles/              # Tailwind & global styles
├── public/                  # Assets statis
├── .env.example             # Variabel lingkungan
├── package.json
└── README.md
```

---

## ⚙️ Instalasi & Setup Lokal

### 1. Clone repositori
```bash
git clone https://github.com/noah-isme/devlogia.git
cd devlogia
```

### 2. Instal dependensi
```bash
pnpm install
```

### 3. Konfigurasi environment
Buat file `.env` berdasarkan `.env.example`:
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/devlogia"
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
UPLOADTHING_SECRET="your-upload-secret"
```

### 4. Migrasi & seed database
```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

### 5. Jalankan aplikasi
```bash
pnpm dev
```
Buka di browser: [http://localhost:3000](http://localhost:3000)

---

## 🧠 Arsitektur Data (Ringkas)

```
User(id, email, password_hash, role, created_at)
Post(id, slug, title, summary, content_mdx, cover_url,
     status, published_at, author_id, created_at, updated_at)
Tag(id, name, slug)
PostTag(post_id, tag_id)
Page(id, slug, title, content_mdx, published, created_at, updated_at)
Media(id, url, alt, owner_id, created_at)
```

---

## 🧪 Scripts

| Perintah | Fungsi |
|-----------|--------|
| `pnpm dev` | Jalankan dev server |
| `pnpm build` | Build untuk production |
| `pnpm start` | Jalankan hasil build |
| `pnpm lint` | Jalankan ESLint |
| `pnpm test` | Jalankan unit test |
| `pnpm format` | Format dengan Prettier |

---

## 🌐 Deployment

- **Frontend:** [Vercel](https://vercel.com/)
- **Database:** [Railway.app](https://railway.app/) atau [Neon.tech](https://neon.tech/)
- **Storage:** Cloudflare R2 / Supabase Storage
- **CI/CD:** GitHub Actions (lint + test + deploy)

---

## 🧰 TODO (Development Checklist)

- [ ] Auth system (NextAuth + JWT)
- [ ] CRUD Post/Page
- [ ] MDX Editor + autosave
- [ ] File upload (UploadThing)
- [ ] SEO helper + OG image generator
- [ ] Sitemap + RSS
- [ ] Tags & search
- [ ] Unit tests + e2e tests
- [ ] Deployment pipeline

---

## 💬 Kontribusi

Meskipun ini proyek pribadi, kontribusi ide & feedback sangat diterima!  
Buka issue atau PR untuk diskusi pengembangan fitur baru.

---

## 🧑‍💻 Lisensi

MIT © 2025 [Noah Is Me](https://github.com/noah-isme)  
Crafted with ❤️ & clean code.
