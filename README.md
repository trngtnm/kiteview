# KiteView

macOS-first PDF reader (Phase 0). Open a local PDF with continuous scroll and Fora-inspired side gutters reserved for future AI annotations.

## Prerequisites

- Node.js >= 20.19
- Xcode + CocoaPods
- macOS 14+

## Setup

```bash
npm install
cp .env.example .env   # edit Supabase / GPT endpoint URLs
npm run pods --workspace=@kiteview/macos
```

## Run

```bash
# Terminal 1
npm start

# Terminal 2
npm run macos
```

## Env

Root `.env` (see `.env.example`):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GPT_ENDPOINT_URL` — Edge Function URL (secrets stay server-side)
