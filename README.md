# 9Router — Router AI & Penghematan Token

**Jangan berhenti coding. Hemat 20-40% token dengan RTK + auto-fallback ke model AI gratis & murah.**

**Hubungkan semua tool AI CLI (Claude Code, Codex, OpenClaw, Cursor, Cline, Gemini, OpenCode...) ke 40+ Provider AI & 100+ Model.**

[![npm](https://img.shields.io/npm/v/9router.svg)](https://www.npmjs.com/package/9router)
[![Downloads](https://img.shields.io/npm/dm/9router.svg)](https://www.npmjs.com/package/9router)
[![Docker Pulls](https://img.shields.io/docker/pulls/decolua/9router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/decolua/9router)
[![GHCR](https://img.shields.io/badge/GHCR-el--pablos%2F9router-blue?logo=github)](https://github.com/el-pablos/9router/pkgs/container/9router)
[![License](https://img.shields.io/npm/l/9router.svg)](https://github.com/el-pablos/9router/blob/main/LICENSE)

[🚀 Mulai Cepat](#-mulai-cepat) • [💡 Fitur](#-fitur-utama) • [📖 Setup](#-panduan-setup) • [🌐 Website](https://9router.com)

---

## 🤔 Kenapa 9Router?

**Hentikan pemborosan uang, token, dan batas limit:**

- ❌ Kuota langganan expired tapi tidak terpakai setiap bulan
- ❌ Rate limit berhenti di tengah coding
- ❌ Output tool (git diff, grep, ls...) burn token cepat
- ❌ API mahal ($20-50/bulan per provider)
- ❌ Switch manual antar provider

**9Router menyelesaikan ini:**

- ✅ **RTK Token Saver** — Auto-compress konten tool_result, hemat 20-40% token per request
- ✅ **Maksimalkan Langganan** — Track kuota, gunakan setiap bit sebelum reset
- ✅ **Auto Fallback** — Subscription → Murah → Gratis, zero downtime
- ✅ **Multi-Account** — Round-robin antar akun per provider
- ✅ **Universal** — Berfungsi dengan Claude Code, Codex, Cursor, Cline, semua CLI tool

---

## 🔄 Bagaimana 9Router Bekerja

```
┌─────────────┐
│  CLI Tool   │  (Claude Code, Codex, OpenClaw, Cursor, Cline...)
│   Kamu      │
└──────┬──────┘
       │ http://localhost:20128/v1
       ↓
┌─────────────────────────────────────────────┐
│           9Router (Smart Router)            │
│  • RTK Token Saver (potong token tool_result)│
│  • Format translation (OpenAI ↔ Claude)     │
│  • Quota tracking                           │
│  • Auto token refresh                       │
└──────┬──────────────────────────────────────┘
       │
       ├─→ [Tier 1: SUBSCRIPTION] Claude Code, Codex, GitHub Copilot
       │   ↓ kuota habis
       ├─→ [Tier 2: MURAH] GLM ($0.6/1M), MiniMax ($0.2/1M)
       │   ↓ budget habis
       └─→ [Tier 3: GRATIS] Kiro, OpenCode Free, Vertex ($300 credits)

Hasil: Never stop coding, biaya minimal + hemat 20-40% token via RTK
```

---

## 🚀 Mulai Cepat

**1. Install globally:**

```bash
npm install -g 9router
9router
```

🎉 Dashboard terbuka di `http://localhost:20128`

**2. Hubungkan provider GRATIS (tanpa signup):**

Dashboard → Providers → Connect **Kiro AI** (free Claude unlimited) atau **OpenCode Free** (tanpa auth) → Selesai!

**3. Gunakan di CLI tool kamu:**

```
Pengaturan Claude Code/Codex/OpenClaw/Cursor/Cline:
  Endpoint: http://localhost:20128/v1
  API Key: [copy dari dashboard]
  Model: kr/claude-sonnet-4.5
```

**Selesai!** Mulai coding dengan model AI GRATIS.

**Alternatif: jalankan dari source:**

```bash
git clone https://github.com/el-pablos/9router.git
cd 9router
npm install --legacy-peer-deps
npm run dev
```

---

## 🛠️ Tool CLI yang Didukung

9Router mendukung semua tool AI CLI utama:

| Tool | Status | Catatan |
|------|--------|---------|
| **Claude Code** | ✅ Tested | API key + OAuth |
| **GitHub Copilot** | ✅ Tested | Via Codex CLI |
| **Codex CLI** | ✅ Tested | OpenAI format |
| **OpenClaw** | ✅ Tested | Universal |
| **Cursor IDE** | ✅ Tested | HTTP proxy mode |
| **Cline** | ✅ Tested | HTTP proxy mode |
| **Continue / RooCode** | ✅ Tested | OpenAI compatible |
| **OpenCode** | ✅ Tested | OpenAI compatible |
| **Kilo Code** | ✅ Tested | HTTP proxy mode |
| **Lintian** | ✅ Tested | HTTP proxy mode |

---

## 🌐 Provider yang Didukung

### 🔐 OAuth Providers (Login dengan Akun)

| Provider | Model | Biaya |
|----------|-------|-------|
| **Anthropic Claude** | claude-sonnet-4.5, claude-opus-4.7 | Pakai langgananmu |
| **OpenAI** | GPT-4.5, GPT-4o | Pakai langgananmu |
| **Google Gemini** | gemini-2.5-flash, gemini-2.5-pro | Pakai langgananmu |
| **GitHub Copilot** | claude-sonnet via Codex | Pakai langgananmu |

### 🆓 Provider Gratis (Tanpa Auth)

| Provider | Model | Limit |
|----------|-------|-------|
| **Kiro AI** | claude-sonnet-4.5 + GLM-5 + MiniMax | Unlimited, FREE |
| **OpenCode Free** | auto-fetch dari server | Tanpa auth |
| **Vertex AI** | gemini-2.5-flash | $300 free credits (GCP baru) |

### 🔑 Provider API Key (40+ model)

| Provider | Mulai dari |
|----------|-----------|
| **GLM-5.1** | $0.6/1M tokens |
| **MiniMax M2.7** | $0.20/1M tokens |
| **Kimi K2.5** | $9/bulan flat |
| **DeepSeek** | $0.1/1M tokens |
| **Groq** | Free tier tersedia |
| **Together AI** | Multi-model discount |
| **OpenRouter** | 100+ model |
| + 35+ provider lainnya |

---

## 💡 Fitur Utama

### 🚀 RTK Token Saver

Hemat 20-40% token per request dengan mengkompres output tool seperti `git diff`, `grep`, `ls`, `find`, dan output CLI lainnya.

```
Tanpa RTK: tool_result = 5000 tokens ($0.05)
Dengan RTK: tool_result = 3000 tokens ($0.03)
Hemat: $0.02 per request
```

RTK otomatis aktif untuk semua request. Tidak perlu konfigurasi tambahan.

### 🎯 Smart 3-Tier Fallback

9Router secara otomatis switch antar tier:

1. **Tier 1 (Subscription)** — Pakai langgananmu dulu
2. **Tier 2 (Cheap)** — Switch ke GLM/MiniMax kalau budget habis
3. **Tier 3 (Free)** — Kiro/OpenCode/Vertex kalau semua habis

Tidak ada downtime. Tidak ada interupsi.

### 📊 Real-Time Quota Tracking

Dashboard menampilkan kuota per provider secara real-time:

- Usage per account
- Reset countdown timers
- Budget burn rate
- Alert sebelum habis

### 🔄 Format Translation

Semua format AI didukung dan dikonversi secara otomatis:

- **OpenAI** → Claude (dan sebaliknya)
- **Claude** → Kiro (direct route, bypass OpenAI pivot)
- **Anthropic** → Google Gemini → OpenAI → semua format

### 👥 Multi-Account Support

Round-robin antar multiple akun per provider:

```
Account 1: 80% quota → Account 2: 60% quota → Account 3: 40% quota
```

Semua akun terpakai merata. Tidak ada akun yang idle.

### 🔄 Auto Token Refresh

OAuth token di-refresh otomatis sebelum expired. Tidak perlu login ulang manual.

### 🎨 Custom Combos

Buat kombinasi provider + model sesuai kebutuhan:

```
Combo "Coding Max":
  - Tier 1: claude-sonnet-4.5 (subscription)
  - Tier 2: glm-5.1 (murah)
  - Tier 3: kiro/claude-sonnet-4.5 (gratis)
```

Cek circular dependency untuk mencegah infinite loop.

### 📝 Request Logging

Semua request di-log dengan:

- Timestamp
- Model yang digunakan
- Token usage
- Biaya
- Response status

Log tersimpan lokal, bisa di-export kapan saja.

### 💾 Cloud Sync

Sync data antar multiple device:

- Kuota tracking
- API keys
- Combo configurations
- Request logs

### 📊 Usage Analytics

Dashboard analytics menampilkan:

- Total token usage per bulan
- Biaya per provider
- Token savings dari RTK
- Hit rate per tier

---

## 📖 Panduan Setup

### Claude Code (Pro/Max)

1. Buka dashboard 9Router → Providers → Connect **Anthropic**
2. Login dengan akun Anthropic (OAuth)
3. Copy API key dan endpoint dari dashboard
4. Buka Claude Code → Settings → API Configuration:

```
Endpoint: http://localhost:20128/v1
API Key: [paste dari dashboard]
Model: anap/sonnet-4.5
```

### OpenAI Codex (Plus/Pro)

1. Buka dashboard → Providers → Connect **OpenAI**
2. Login dengan akun OpenAI (OAuth)
3. Copy API key dan endpoint
4. Buka Codex → Settings:

```
Endpoint: http://localhost:20128/v1
API Key: [paste dari dashboard]
Model: gpt-4.5
```

### GitHub Copilot

1. Buka dashboard → Providers → Connect **GitHub Copilot**
2. Auth dengan GitHub
3. Copy API key dan endpoint
4. Konfigurasi di tool pilihan

### Cursor IDE

1. Buka Settings → HTTP Proxy
2. Set proxy ke `http://localhost:20128`
3. Set API key dari dashboard
4. Model sesuai combo yang dibuat

### GLM-5.1 / GLM-4.7 (Daily reset, $0.6/1M)

1. Buka dashboard → Providers → Add New
2. Pilih GLM → masukkan API key
3. Set sebagai Tier 2 fallback
4. GLM reset setiap hari jam 00:00 UTC

### MiniMax M2.7 (5h reset, $0.20/1M)

1. Buka dashboard → Providers → Add New
2. Pilih MiniMax → masukkan API key
3. Set sebagai Tier 2 atau Tier 3
4. MiniMax reset setiap 5 jam

### Kiro AI (Claude 4.5 + GLM-5 + MiniMax FREE)

1. Buka dashboard → Providers → Connect **Kiro AI**
2. Auth dengan email (gratis)
3. Langsung bisa pakai — tidak ada biaya

### VPS Deployment

```bash
# Clone repository
git clone https://github.com/el-pablos/9router.git
cd 9router

# Install dependencies
npm install --legacy-peer-deps

# Copy environment file
cp .env.example .env.local
# Edit .env.local dengan konfigurasi kamu

# Jalankan
npm run dev
# atau untuk production:
npm run build
npm start
```

**Atau dengan PM2:**

```bash
npm install -g pm2
pm2 start npm --name "9router" -- start
pm2 save
pm2 startup
```

---

## 🐳 Docker Deployment

**Build image:**

```bash
./deploy.sh docker
```

**Jalankan container:**

```bash
docker run -p 20128:20128 \
  --env-file .env.local \
  ghcr.io/el-pablos/9router:latest
```

**Docker Compose (recommended):**

```yaml
version: '3.8'
services:
  9router:
    image: ghcr.io/el-pablos/9router:latest
    ports:
      - "20128:20128"
    env_file:
      - .env.local
    volumes:
      - data:/app/data
    restart: unless-stopped

volumes:
  data:
```

---

## 🔧 Environment Variables

```bash
# Required
JWT_SECRET=change-me-to-a-long-random-secret
INITIAL_PASSWORD=change-me
DATA_DIR=/var/lib/9router

# Runtime
PORT=20128
NODE_ENV=production
NEXT_PROXY_CLIENT_MAX_BODY_SIZE=268435456

# Security
API_KEY_SECRET=endpoint-proxy-api-key-secret
MACHINE_ID_SALT=endpoint-proxy-salt
ENABLE_REQUEST_LOGS=false
OBSERVABILITY_ENABLED=true
AUTH_COOKIE_SECURE=false
REQUIRE_API_KEY=false

# Cloud sync
BASE_URL=http://localhost:20128
CLOUD_URL=https://9router.com
NEXT_PUBLIC_BASE_URL=http://localhost:20128
NEXT_PUBLIC_CLOUD_URL=https://9router.com

# Outbound proxy (optional)
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
ALL_PROXY=socks5://127.0.0.1:7890
```

---

## 📊 Model yang Tersedia

### Anthropic
- `anap/sonnet-4.5` — claude-sonnet-4-20250514
- `anap/opus-4.7` — claude-opus-4-20250320

### OpenAI
- `opn/gpt-4.5` — gpt-4.5-turbo
- `opn/gpt-4o` — gpt-4o

### Google Gemini
- `gemini/2.5-flash` — gemini-2.5-flash
- `gemini/2.5-pro` — gemini-2.5-pro

### Kiro
- `kr/claude-sonnet-4.5` — Kiro Claude (FREE)
- `kr/glm-5` — Kiro GLM-5 (FREE)
- `kr/minimax` — Kiro MiniMax (FREE)

### Budget Models
- `glm/5.1` — $0.6/1M
- `minimax/m2.7` — $0.20/1M
- `kimi/k2.5` — $9/bulan flat

---

## 🐛 Troubleshooting

### Error: "Connection refused"

Pastikan 9Router berjalan:

```bash
npm start
# atau
pm2 status
```

### Error: "Invalid API key"

1. Cek API key di dashboard
2. Pastikan tidak expired
3. Cek apakah provider sudah di-connect

### Error: "Rate limit exceeded"

9Router otomatis switch ke fallback tier. Kalau semua tier habis:

1. Tunggu reset (biasanya 1h-24h)
2. Atau upgrade ke plan yang lebih tinggi
3. Atau tambah akun alternatif

### Error: "Token savings tidak muncul"

RTK butuh beberapa request untuk calibrate. Kalau belum aktif setelah 5 request, cek:

1. Request menggunakan tool (RTK cuma aktif kalau response mengandung tool_result)
2. Dashboard → Analytics → RTK Savings

### Error: "OAuth token expired"

9Router auto-refresh token. Kalau masih error:

1. Buka dashboard → Providers
2. Re-connect provider yang error
3. Login ulang kalau diperlukan

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 22+ (Next.js 16, standalone output)
- **Database:** sql.js (SQLite in-browser, lokal)
- **Auth:** JWT + cookie-based
- **Format Translation:** Custom translator (OpenAI ↔ Claude ↔ Kiro ↔ Gemini)
- **Proxy:** socks-proxy-agent + http-proxy-middleware
- **Testing:** Vitest
- **Deployment:** Docker, Railway, Fly.io, VPS

---

## 📝 API Reference

### Chat Completions

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### List Models

```bash
curl http://localhost:20128/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---



---

## 💰 Ringkasan Biaya

9Router dirancang untuk meminimalkan biaya tanpa mengorbankan kualitas:

### Skalabilitas Biaya

| Strategi | Biaya/Bulan | Use Case |
|---------|-------------|----------|
| **Gratis Only** | $0 | Development/testing |
| **Subscription + RTK** | $20-50 | Individual coder |
| **Subscription + Cheap Fallback** | $5-15 | Cost-conscious teams |
| **Budget + Free Fallback** | $2-5 | Startups |
| **Enterprise** | Custom | Tim besar |

### Cara RTK Menghemat

RTK (Request Token Keeper) bekerja dengan cara:

1. **Capture tool output** — Git diff, grep results, ls output, dll
2. **Analisis struktural** — Identifikasi pola yang bisa dikompres
3. **Smart compression** — Hapus whitespace tidak perlu, singkatin path, truncate output panjang
4. **Restore on display** — Tool result tetap utuh saat ditampilkan ke user

Contoh:
```
Git diff output (tanpa RTK): ~8000 tokens
Git diff output (dengan RTK): ~4200 tokens
Hemat: ~48% atau $0.04 per request
```

### Estimasi Penghematan Bulanan

| Aktivitas | Request/Hari | Savings/Bulan |
|-----------|-------------|---------------|
| Light coding | 50 | ~$3 |
| Medium coding | 200 | ~$12 |
| Heavy coding | 500 | ~$30 |
| Team (5 orang) | 1000 | ~$150 |

---

## 🎯 Use Cases

### Case 1: "Saya punya Claude Pro subscription"

Setup: Claude Pro → GLM fallback → Kiro free

Flow:
1. Semua request lewat Claude Pro
2. Kalau quota Claude Pro 80% habis → switch ke GLM ($0.6/1M)
3. Kalau GLM budget habis → switch ke Kiro (FREE)
4. Tidak ada downtime, tidak ada interupsi

Cost: Pakai langganan yang sudah ada + $0-5/month untuk GLM

### Case 2: "Saya mau zero cost"

Setup: Kiro → OpenCode Free → Vertex

Flow:
1. Semua request lewat Kiro (FREE, unlimited)
2. Kalau Kiro down → switch ke OpenCode Free
3. Kalau OpenCode error → switch ke Vertex ($300 credits)
4. Tidak ada biaya sama sekali

Cost: $0

### Case 3: "Saya butuh 24/7 coding, tanpa interupsi"

Setup: Multi-account Claude + Kiro + Vertex

Flow:
1. Round-robin antar 3 akun Claude
2. Kalau semua akun habis → switch ke Kiro
3. Kalau Kiro down → switch ke Vertex
4. Monitor via dashboard real-time

Cost: Pakai langganan + $0-10/month untuk backup

### Case 4: "Saya mau FREE AI di OpenClaw"

Setup: Dashboard → Providers → Kiro → Connect

Flow:
1. Buka dashboard 9Router
2. Connect Kiro AI (gratis, email only)
3. Copy endpoint + API key
4. Paste ke OpenClaw settings
5. Selesai — mulai coding dengan FREE AI

Cost: $0

---

## 🏗️ Arsitektur Internal

### Komponen Utama

```
9Router/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (dashboard)/ # Dashboard UI
│   │   └── api/         # API routes
│   ├── lib/             # Core logic
│   │   ├── db/          # SQLite via sql.js
│   │   ├── oauth/       # OAuth provider integration
│   │   └── security/    # Auth, rate limiting
│   └── mitm/            # MITM proxy server
├── open-sse/
│   ├── config/          # Provider configs
│   ├── executors/        # API executors
│   ├── handlers/         # Request handlers
│   ├── translator/       # Format translation
│   └── utils/            # Utilities (RTK, cloaking, socks)
└── tests/                # Vitest test suite
```

### Flow Request

```
Client Request
    ↓
Middleware (auth check, rate limit)
    ↓
RTK Token Saver (kompres tool_result kalau ada)
    ↓
Format Translator (konversi OpenAI ↔ Claude ↔ dll)
    ↓
Provider Executor (pilih tier yang aktif)
    ↓
Provider API (Anthropic, OpenAI, Kiro, dll)
    ↓
Response Translator (konversi balik ke format client)
    ↓
RTK Decompress (restore tool_result)
    ↓
Client Response
```

### Keamanan

- JWT-based authentication
- Cookie secure flag (production)
- Rate limiting per API key
- Input sanitization
- CORS policy yang ketat
- Atomic file writes untuk data persistence

---

## 🔒 Keamanan & Privasi

### Data yang Disimpan Lokal

- API keys (encrypted di localStorage)
- Request logs (tanpa prompt/response content)
- Usage analytics
- Combo configurations

### Data yang TIDAK Disimpan

- Prompt content
- Response content
- Model outputs
- User credentials (hanya OAuth token, bukan password)

### Best Practices

1. **Gunakan HTTPS** di production
2. **Set REQUIRE_API_KEY=true** untuk environment production
3. **Rotate JWT_SECRET** secara berkala
4. **Jangan share API key** di public channels
5. **Monitor logs** untuk deteksi anomali

---

## 🧪 Testing

9Router punya test suite lengkap dengan Vitest:

```bash
# Jalankan semua test
npx vitest run

# Jalankan dengan watch mode
npx vitest

# Jalankan specific test file
npx vitest run tests/translator/claude-kiro-direct.test.js

# Jalankan dengan coverage
npx vitest run --coverage
```

### Test Categories

- **Unit tests** — Kiro profile ARN, socks dispatcher
- **Translator tests** — Claude ↔ Kiro, OpenAI ↔ Claude
- **Integration tests** — Provider API calls
- **Security tests** — Auth, rate limiting

---

## 🔄 Update & Maintenance

### Update ke versi terbaru

```bash
cd 9router
git pull origin master
npm install --legacy-peer-deps
npm run build
pm2 restart 9router
```

### Backup data

```bash
# Backup database
cp data/*.db ./backup/

# Backup config
cp .env.local ./backup/
```

### Rollback

```bash
# Rollback ke commit tertentu
git reset --hard <commit-hash>
npm run build
pm2 restart 9router
```

## 📧 Support

- **GitHub Issues:** https://github.com/el-pablos/9router/issues
- **Website:** https://9router.com

---

## 📄 License

MIT License — lihat [LICENSE](LICENSE) untuk detail.