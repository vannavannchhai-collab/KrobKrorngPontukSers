# ប្រព័ន្ធគ្រប់គ្រងពិន្ទុសិស្ស — KrobKrorng Pontuk Sers

ប្រព័ន្ធពេញលេញសម្រាប់សាលារៀនកម្ពុជា ដើម្បីគ្រប់គ្រង **សិស្ស ថ្នាក់ មុខវិជ្ជា គ្រូបង្រៀន ពិន្ទុ វត្តមាន និងរបាយការណ៍សិក្សា** — ជាមួយការគណនាមធ្យមភាគ និទ្ទេស និងចំណាត់ថ្នាក់ស្វ័យប្រវត្តិ។

> ## 🔐 គ្មានគណនីសាកល្បង (demo) ទេ
> ប្រព័ន្ធនេះ **គ្មានទិន្នន័យគំរូ និងគ្មានគណនីសាកល្បង**។
> **ការចុះឈ្មោះសាធារណៈត្រូវបានបិទ** — គណនីបង្កើតដោយ **អ្នកគ្រប់គ្រង** តែម្តង។
> ពេលប្រព័ន្ធទទេ មានតែទំព័រ **បង្កើតគណនីម្ចាស់ប្រព័ន្ធ** (`/first-run`) មួយដងគត់ ដោយប្រើ Gmail ពិត។
>
> **រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ វណ្ណា វណ្ណឆៃ**

---

## 🚀 ដំណើរការលើកដំបូង

```bash
npm install
npm run build
npm start          # http://localhost:4173
```

1. ពេលបើកដំបូង បង្កើត **គណនីម្ចាស់ប្រព័ន្ធ** នៅ `/first-run` ដោយប្រើ Gmail
   (ឧ. `yourname@gmail.com`) និងលេខសម្ងាត់ ≥ ៨ តួអក្សរ។ នេះជាគណនីតែមួយគត់ដែលបង្កើតដោយខ្លួនឯងបាន។
2. គណនីនោះទទួលបានតួនាទី **អ្នកគ្រប់គ្រង** ហើយប្រព័ន្ធនាំទៅទំព័រ **រៀបចំប្រព័ន្ធ** (`/setup`)៖
   - ព័ត៌មានសាលា (ឈ្មោះ អាសយដ្ឋាន នាយកសាលា…)
   - ឆ្នាំសិក្សា និងឆមាសទី១–ទី២
   - មុខវិជ្ជាស្តង់ដារ ១២ (ឬបង្កើតដោយខ្លួនឯង)
   - ថ្នាក់រៀនដំបូង
3. បន្ថែមសិស្ស → ចាត់តាំងគូថ្នាក់/មុខវិជ្ជា → បញ្ចូលពិន្ទុ → មើលលទ្ធផល និងបោះពុម្ព។

**ការចុះឈ្មោះសាធារណៈត្រូវបានបិទទាំងស្រុង**។ គណនីគ្រូបង្រៀន (តួនាទី `teacher`)
បង្កើតដោយអ្នកគ្រប់គ្រងនៅ **គ្រូបង្រៀន → បន្ថែមគ្រូថ្មី** (ឈ្មោះ, Gmail, លេខសម្ងាត់)។
អ្នកគ្រប់គ្រងក៏អាច **កំណត់លេខសម្ងាត់ឡើងវិញ** ឬបិទគណនីនៅទីនោះដែរ។

### ពាក្យបញ្ជា

| ពាក្យបញ្ជា | ការងារ |
|---|---|
| `npm run build` | build client (production) |
| `npm start` | ដំណើរការ server (បម្រើ API + dist) |
| `npm run dev` | ដំណើរការ server ជាមួយ auto-reload |
| `npm run typecheck` | ពិនិត្យ TypeScript |
| `npm run reset` | លុបមូលដ្ឋានទិន្នន័យ (ចាប់ផ្ដើមពីទទេវិញ) |

### អថេរបរិស្ថាន

```
# ── Database ────────────────────────────────────────────────
TURSO_DATABASE_URL=...           # libsql://...turso.io (ទុកទទេ = ប្រើឯកសារ SQLite)
TURSO_AUTH_TOKEN=...             # token ពី Turso (ចាំបាច់ពេលប្រើ Turso)
DB_PATH=data/school.db           # ឯកសារ SQLite (ពេល TURSO_DATABASE_URL ទទេ)

# ── សុវត្ថិភាព ───────────────────────────────────────────────
JWT_SECRET=...                   # កូនសោចុះហត្ថលេខា token (ចាំបាច់លើ Vercel)
PORT=4173

# ── Google OAuth (ស្រេចចិត្ត) ────────────────────────────────
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...          # បើទុកទទេ គណនាពី host នៃសំណើ
```

ចម្លង `.env.example` ទៅ `.env` (ឯកសារ `.env` ត្រូវបាន ignore ដោយ git)។

---

## ☁️ ដាក់ដំណើរការលើ Vercel + Turso (libSQL)

Vercel គឺ serverless — គ្មាន disk អចិន្ត្រៃយ៍ទេ ដូច្នេះទិន្នន័យត្រូវរក្សាទុកក្នុង
**Turso** (SQLite នៅលើ cloud, ឥតគិតថ្លៃ)។ កូដមួយគាំទ្រទាំងពីរ៖

| `TURSO_DATABASE_URL` | Database ដែលប្រើ |
|---|---|
| ទទេ (local / VPS) | ឯកសារ SQLite `data/school.db` |
| `libsql://...` | Turso តាម network |

### ១. បង្កើត database នៅ Turso

1. ចូល <https://turso.tech> ហើយបង្កើត database ថ្មី (ឧ. `krobkrorng-pontuk-sers`)។
2. ចម្លង **Database URL** — ទម្រង់ `libsql://<db>-<org>.turso.io`។
3. បង្កើត **token**: `turso db tokens create krobkrorng-pontuk-sers`
   (ឬតាម Dashboard → *Database → Tokens* → *Create token*)។

### ២. ដាក់កូដលើ Vercel

1. Push កូដទៅ GitHub រួច Vercel → **Add New → Project** → ជ្រើស repo នេះ។
   Framework ត្រូវបានរកឃើញជា **Vite** ដោយស្វ័យប្រវត្តិ។
2. Settings → **Environment Variables** បន្ថែម (ធីក Production, Preview, Development)៖

| ឈ្មោះ | តម្លៃ | ចាំបាច់ |
|---|---|---|
| `TURSO_DATABASE_URL` | `libsql://...turso.io` | ✅ |
| `TURSO_AUTH_TOKEN` | token ពី Turso | ✅ |
| `JWT_SECRET` | ខ្សែអក្សរបំពេញចិត្ត ≥ 32 តួ (ឧ. `openssl rand -hex 48`) | ✅ |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ស្រេចចិត្ត | – |
| `GOOGLE_REDIRECT_URI` | `https://<domain>/api/auth/google/callback` | – |

3. ចុច **Deploy**។ `vercel.json` កំណត់រួចហើយ៖
   - Build: `npm run build` → `dist/` (frontend បម្រើដោយ CDN)
   - API: រាល់ `/api/*` ចូល function តែមួយ `api/[...path].ts` (Express app ដូចគ្នា)
   - SPA fallback: route ទាំងអស់ត្រឡប់ទៅ `index.html`

### ៣. បន្ទាប់ពី deploy

- ចូល `<domain>` លើកដំបូង → ទំព័រ **បង្កើតគណនីម្ចាស់ប្រព័ន្ធ** (admin ដំបូង, Gmail)។
- Schema (តារាងទាំងអស់) ត្រូវបង្កើតដោយស្វ័យប្រវត្តិនៅសំណើដំបូង — គ្មានជំហាន migrate ដោយដៃទេ។
- **Google OAuth**: redirect URI ត្រូវជា `https://<domain>/api/auth/google/callback`
  (បញ្ចូលក្នុង Google Cloud Console *និង* ក្នុង ការកំណត់ → ព័ត៌មានសាលា)។
- បើ Turso មិនភ្ជាប់បាន API នឹងឆ្លើយ `500` ជាមួយសារ
  «មិនអាចភ្ជាប់ទៅ database បានទេ» — ពិនិត្យ URL/token ម្ដងទៀត។

> ⚠️ កុំប្រើ `data/school.db` នៅលើ Vercel — filesystem អានបានតែប៉ុណ្ណោះ។
> ការរត់ក្នុងម៉ាស៊ីនផ្ទាល់ ឬ VPS (`npm start`) នៅតែប្រើ SQLite ធម្មតា។

---

## 🔐 ការកំណត់ «ចូលប្រើដោយ Google» (OAuth 2.0)

មាន **ពីរវិធី** ក្នុងការកំណត់ — មិនចាំបាច់កែកូដទេ៖

### វិធីទី១ (ងាយស្រួលបំផុត) — កំណត់ក្នុងកម្មវិធី
1. ចូលជា **អ្នកគ្រប់គ្រង** → **ការកំណត់ → ព័ត៌មានសាលា → ចូលប្រើដោយ Google**
2. ចម្លង **Authorized redirect URI** ដែលបង្ហាញនៅទីនោះ
3. បើក <https://console.cloud.google.com/apis/credentials> → **Create credentials → OAuth client ID**
   → Application type: **Web application** → បិទភ្ជាប់ redirect URI ខាងលើ
4. ចម្លង **Client ID** និង **Client secret** មកបំពេញក្នុងកម្មវិធី → **រក្សាទុក និងបើកដំណើរការ**
5. បើ OAuth consent screen នៅ **Testing** → បន្ថែមអ៊ីមែលរបស់អ្នកក្នុង **Test users**
   (បើអត់ នឹងឃើញ “Access blocked”)

ប៊ូតុង **“ចូលប្រើដោយ Google”** នឹងបង្ហាញនៅទំព័រចូលប្រើភ្លាមៗ —
**មិនចាំបាច់ restart ម៉ាស៊ីនមេទេ**។
Client Secret ត្រូវបាន **អ៊ិនគ្រីប AES-256-GCM** មុនរក្សាទុក និងមិនផ្ញើត្រឡប់ទៅ browser ឡើយ។

### វិធីទី២ — environment variables (សម្រាប់ server)
```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
# ស្រេចចិត្ត បើ redirect URI មិនអាចគណនាពី host បាន
GOOGLE_REDIRECT_URI=https://example.com/api/auth/google/callback
```
ចម្លង `.env.example` ទៅ `.env` (ត្រូវបាន ignore ដោយ git)។ បើកំណត់តាម env
ផ្ទាំងការកំណត់នឹងបង្ហាញថា «កំពុងមកពី environment variables» ហើយមិនអនុញ្ញាតកែក្នុងកម្មវិធី។

### ដំណើរការខាងក្នុង
- `GET /api/auth/google/status` → { enabled, source, redirect_uri }
- `GET /api/auth/google/start` → `state` + PKCE (`S256`) រួចបញ្ជូនទៅ Google
- `GET /api/auth/google/callback` → ផ្ទៀងផ្ទាត់ state, ប្ដូរ code → token,
  ពិនិត្យ `email_verified` និងដែន `@gmail.com`, បន្ទាប់មកបង្កើត/ភ្ជាប់គណនី
- `POST /api/auth/google/exchange` → one-time code (២ នាទី, ប្រើម្ដង) → JWT
- `GET/PUT/DELETE /api/admin/google` → ការកំណត់ (អ្នកគ្រប់គ្រងប៉ុណ្ណោះ, មាន audit log)
- Google ចូលបានតែគណនីដែល **មានរួច** (បញ្ជាក់ដោយអ្នកគ្រប់គ្រង) — បើអ៊ីមែលមិនទាន់មាន
  បង្ហាញ «គណនីនេះមិនទាន់មានក្នុងប្រព័ន្ធ»។ លើកលែងតែពេលប្រព័ន្ធទទេ (បង្កើតគណនីម្ចាស់)។
- ក្នុង iframe (Live Preview) Google មិនអនុញ្ញាត consent ក្នុង frame → ប្រព័ន្ធបើកជា **popup**
  ហើយផ្ទេរ session តាម `postMessage`។ បើ popup ត្រូវទប់ស្កាត់ មានប៊ូតុង «បើកក្នុងផ្ទាំងថ្មី»។

---

## ✨ មុខងារសំខាន់ៗ

| មុខងារ | ការពិពណ៌នា |
|---|---|
| **ចូលប្រើ & គណនី** | គ្មានការចុះឈ្មោះសាធារណៈ — គណនីបង្កើតដោយអ្នកគ្រប់គ្រង; JWT, scrypt, ការពារ brute-force, **ចូលប្រើដោយ Google (OAuth 2.0 + PKCE)** |
| **រៀបចំប្រព័ន្ធដំបូង** | ទំព័រ setup ណែនាំជាជំហានៗ (សាលា → ឆ្នាំសិក្សា → មុខវិជ្ជា → ថ្នាក់) |
| **ផ្ទាំងគ្រប់គ្រង** | KPI មធ្យមភាគសាលា អត្រាជាប់ អត្រាវត្តមាន ក្រាហ្វនិន្នាការ ការបែងចែកនិទ្ទេស សិស្សឆ្នើម និងសិស្សត្រូវការយកចិត្តទុកដាក់ |
| **សិស្ស** | បញ្ជីសិស្ស (ស្វែងរក/តម្រង/តម្រៀប/ទំព័រ) ប្រវត្តិពេញលេញ CRUD ផ្ទេរថ្នាក់ជាក្រុម នាំចូល/នាំចេញ CSV |
| **ថ្នាក់រៀន** | គ្រូបន្ទុកថ្នាក់, បន្ថែមមុខវិជ្ជា និងចាត់តាំងគ្រូបង្រៀនតាមមុខវិជ្ជា |
| **មុខវិជ្ជា** | កូដ ឈ្មោះខ្មែរ/អង់គ្លេស ក្រេឌីត ពណ៌ ស្ថានភាព |
| **បញ្ចូលពិន្ទុ** | តារាងតាមថ្នាក់/មុខវិជ្ជា/ឆមាស គណនាមធ្យមភាគភ្លាមៗ `Ctrl+S` ការពារសិទ្ធិតាមគ្រូ |
| **លទ្ធផលសិក្សា** | មធ្យមភាគ/និទ្ទេស/ចំណាត់ថ្នាក់ (គិតពិន្ទុស្មើ) អត្រាជាប់ នាំចេញ CSV |
| **សៀវភៅពិន្ទុ & សញ្ញាបត្រ** | ទម្រង់ A4 តាមស្តង់ដារ (ក្បាលសាលា, វត្តមាន, មតិយោបល់, ហត្ថលេខា) បោះពុម្ពបាន |
| **វត្តមាន** | កត់ត្រាប្រចាំថ្ងៃ + តារាងសង្ខេបប្រចាំខែ + នាំចេញ CSV |
| **រដ្ឋបាល** | គណនី/តួនាទី, ការកំណត់សាលា/មាត្រដ្ឋាននិទ្ទេស/ទម្ងន់ពិន្ទុ/ឆ្នាំសិក្សា, audit log |

### របៀបគណនា

```
មធ្យមភាគមុខវិជ្ជា = Σ(ពិន្ទុ × ទម្ងន់) ÷ Σ(ទម្ងន់ដែលបានបញ្ចូល)
មធ្យមភាគរួម      = Σ(មធ្យមភាគមុខវិជ្ជា × ក្រេឌីត) ÷ Σ(ក្រេឌីត)
និទ្ទេស          = A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · E ≥ 50 · F < 50
```

ចំណាត់ថ្នាក់គណនាក្នុងថ្នាក់តាមមធ្យមភាគរួម (ពិន្ទុស្មើគ្នាទទួលបានចំណាត់ថ្នាក់ដូចគ្នា)។
ទម្ងន់ត្រូវបានធ្វើឱ្យស្មើស្វ័យប្រវត្តិ ដូច្នេះការខកខានបញ្ចូលការវាយតម្លៃមួយ
មិនធ្វើឱ្យសិស្សខាតបង់ពិន្ទុដោយអយុត្តិធម៌ទេ។

### សិទ្ធិប្រើប្រាស់

- **អ្នកគ្រប់គ្រង (admin)** — គ្រប់គ្រងទាំងអស់៖ សិស្ស ថ្នាក់ មុខវិជ្ជា គណនី ការកំណត់ និងពិន្ទុ។
- **គ្រូបង្រៀន (teacher)** — មើលទិន្នន័យសិក្សា បញ្ចូល/កែពិន្ទុ **តែមុខវិជ្ជាដែលខ្លួនបានចាត់តាំង** និងកត់ត្រាវត្តមានថ្នាក់ដែលខ្លួនទទួលបន្ទុក។

---

## 🛠 បច្ចេកវិទ្យា

- **Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query · Recharts · lucide-react
- **Backend:** Node.js 22 · Express · SQLite ដែលភ្ជាប់មកជាមួយ (`node:sqlite`) · គ្មាន dependency native
- **សុវត្ថិភាព:** JWT (12 ម៉ោង) · កូដពាក្យសម្ងាត់ `scrypt` · RBAC · SQL ប្រើ parameter ១០០% · audit trail · ការពារ brute-force
- **ភាសា:** UI ខ្មែរទាំងស្រុង (Kantumruy Pro / Noto Sans Khmer ជាមួយ fallback ក្នុងម៉ាស៊ីន)

## 🗂 រចនាសម្ព័ន្ធ

```
server/
  index.ts          # standalone server (npm start) — init DB + listen
  app.ts            # Express app (shared by server និង Vercel function)
  db.ts             # dual driver: node:sqlite (local) / @libsql/client (Turso)
  env.ts            # .env loader
  google.ts         # Google OAuth config (env ឬ settings)
  auth.ts           # scrypt · JWT · middleware · RBAC helpers
  compute.ts        # គណនាមធ្យមភាគ/និទ្ទេស/ចំណាត់ថ្នាក់/វត្តមាន
  routes/           # auth (register/login) · academics · students · scores ·
                    # results · attendance · dashboard · admin
api/
  [...path].ts      # Vercel serverless entry — /api/* ទាំងអស់
vercel.json         # build · function · rewrite · headers

src/
  lib/              # api client · auth context · meta hook · helpers · types
  components/       # layout · UI primitives · toast · student form · import modal
  pages/            # login · register · setup · dashboard · students · detail ·
                    # scores · results · report-card · transcript · attendance ·
                    # classes · subjects · teachers · settings · audit
```

---

## ⚖️ រក្សាសិទ្ធិ

© 2026 **វណ្ណា វណ្ណឆៃ (Vanna Vannchai)** — រក្សាសិទ្ធិគ្រប់យ៉ាង។
ការចម្លង ការកែប្រែ ការចែកចាយ ឬការប្រើប្រាស់ពាណិជ្ជកម្ម ត្រូវមានការអនុញ្ញាតជាលាយលក្ខណ៍អក្សរពីម្ចាស់សិទ្ធិ។
សូមមើលឯកសារ [LICENSE](./LICENSE)។
