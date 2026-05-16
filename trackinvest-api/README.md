# TrackInvest API

Background API service for TrackInvest — AI insights, market data, portfolio analytics, notifications, cloud backup, and PDF report generation.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your keys
npm install
npm start
```

Verify it's running:
```bash
curl http://localhost:3000/api/v1/health
```

## API Reference

All endpoints (except `/health`) require the `x-api-key` header set to one of the values in `API_KEYS` env var.

```
x-api-key: sk-your-api-key-here
```

---

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Service status, DB check, AI provider info |

---

### AI Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/chat` | Chat with AI advisor (Gemini or OpenAI) |
| POST | `/api/v1/ai/report` | Generate financial report (full_report / ledger / blueprint / forecast) |

**POST /api/v1/ai/chat**
```json
{
  "message": "How is my portfolio doing?",
  "history": [
    { "role": "user", "text": "My portfolio has 5 stocks" },
    { "role": "model", "text": "Great, let me help you analyze them." }
  ]
}
```

**POST /api/v1/ai/report**
```json
{
  "type": "full_report",
  "portfolioData": { "holdings": [...] }
}
```

---

### Market Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/market/search?query=RELIANCE` | Search stocks, ETFs, mutual funds |
| GET | `/api/v1/market/quote/:symbol` | Real-time quote (e.g. RELIANCE.NS) |
| GET | `/api/v1/market/history/:symbol?range=1mo` | Historical prices |
| GET | `/api/v1/market/mf/:schemeCode` | Indian mutual fund NAV by scheme code |

---

### Portfolio Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/portfolio/analyze` | Full portfolio analysis (returns, allocation, risk, diversification) |
| POST | `/api/v1/portfolio/xirr` | Calculate XIRR from transaction list |
| POST | `/api/v1/portfolio/rebalance` | Generate rebalance suggestions against target allocation |

**POST /api/v1/portfolio/analyze**
```json
{
  "holdings": [
    { "name": "HDFC Bank", "symbol": "HDFCBANK.NS", "type": "stock", "invested": 100000, "currentValue": 125000 },
    { "name": "SBI Bluechip Fund", "type": "mutual_fund", "invested": 50000, "currentValue": 58000 }
  ]
}
```

**POST /api/v1/portfolio/xirr**
```json
{
  "transactions": [
    { "date": "2024-01-15", "amount": -50000 },
    { "date": "2024-06-20", "amount": -25000 },
    { "date": "2025-03-10", "amount": 82000 }
  ]
}
```

**POST /api/v1/portfolio/rebalance**
```json
{
  "holdings": [...],
  "targetAllocation": { "stock": 50, "mutual_fund": 30, "gold": 10, "fd": 10 }
}
```

---

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/notifications/subscribe` | Register browser push subscription |
| POST | `/api/v1/notifications/unsubscribe` | Remove push subscription |
| POST | `/api/v1/notifications/send` | Send push notification to all subscribers |
| POST | `/api/v1/notifications/email` | Send email notification (if SMTP configured) |
| GET | `/api/v1/notifications/log?limit=50` | View sent notification history |

---

### Data Sync & Backup

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sync/backup` | Create a new backup |
| GET | `/api/v1/sync/backups?page=1&limit=20` | List all backups |
| GET | `/api/v1/sync/backup/:id` | Restore / view a backup |
| DELETE | `/api/v1/sync/backup/:id` | Delete a backup |
| POST | `/api/v1/sync/sync` | Quick sync (creates backup labeled "sync") |

---

### PDF Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/pdf/from-html` | Generate PDF from raw HTML |
| POST | `/api/v1/pdf/report/:type` | Generate styled PDF report (full_report / blueprint / ledger / forecast) |

**POST /api/v1/pdf/from-html**
```json
{
  "html": "<h1>My Report</h1><p>Content here</p>",
  "filename": "my-report.pdf"
}
```

## Deployment — Render (Free Tier)

A `render.yaml` is at the **repo root** (`../render.yaml`) for auto-deploy. It has `rootDir: trackinvest-api` so Render runs all commands inside this folder.

1. Push the repo to GitHub
2. On Render.com, create a **New Web Service** and connect your repo
3. Render auto-detects `render.yaml` — or manually configure:
   - **Root Directory**: `trackinvest-api`
   - **Runtime**: Node
   - **Plan**: Free
   - **Build Command**: `npm install --ignore-scripts`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/v1/health`
4. Set all sensitive env vars in Render dashboard

### ⚠ Free Tier Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| No persistent disk | SQLite data lost on redeploy | Use `/sync/backup` to export data before redeploy |
| Spins down after 15min idle | ~30s cold start on first request | Use a cron-job.org ping every 10min |
| 512 MB RAM | Cannot run Chromium for PDF | PDF endpoint returns HTML fallback; render client-side using html2pdf.js |
| No chromium | Puppeteer PDF disabled | Set `BROWSER_DISABLE=true` (done in render.yaml) |

### Data Persistence on Free Tier

Data survives between idle spins but is **lost on redeploy**. Use these endpoints to backup/restore:

```bash
# Before redeploy — save backup
curl -X POST https://your-api.onrender.com/api/v1/sync/backup \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "data": { ... your data ... }, "label": "pre-redeploy" }'

# After redeploy — list and restore
curl https://your-api.onrender.com/api/v1/sync/backups \
  -H "x-api-key: YOUR_KEY"
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Default: 3000 |
| `API_KEYS` | **Yes** | Comma-separated API keys for auth |
| `GEMINI_API_KEY` | One of | Google Gemini API key for AI features |
| `OPENAI_API_KEY` | One of | OpenAI API key (alternative to Gemini) |
| `ALPHA_VANTAGE_API_KEY` | No | Enhanced market data |
| `VAPID_PUBLIC_KEY` | For push | Web Push public key |
| `VAPID_PRIVATE_KEY` | For push | Web Push private key |
| `SMTP_*` | For email | SMTP credentials for email notifications |
| `BROWSER_DISABLE` | No | Set `true` to skip Puppeteer/Chromium (free Render tier) |

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 4
- **Database**: SQLite (via better-sqlite3) — zero config, bundled
- **AI**: Google Gemini 1.5 Flash / OpenAI GPT-4o-mini
- **PDF**: Puppeteer (optional — falls back to HTML on free tier)
- **Cache**: In-memory (Redis optional)
- **Auth**: API key via header
