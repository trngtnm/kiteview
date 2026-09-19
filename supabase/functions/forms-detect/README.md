# forms-detect

Detects blank fillable form fields on PDF page images using OpenAI `gpt-4o-mini` vision (low detail, first page preferred).

## Prerequisites

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
2. A Supabase project linked: `supabase link --project-ref <your-ref>`
3. An OpenAI API key with vision access

## Secrets

Set the OpenAI key as a **server** secret (never put it in the app `.env`):

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

## Deploy

```bash
supabase functions deploy forms-detect
```

## Client env

In the app root `.env`:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

The macOS app invokes this function via `@supabase/supabase-js` as `forms-detect` when AcroForm and local text heuristics find no fields.

## Request / response

**POST** body:

```json
{
  "pages": [
    {
      "pageNumber": 1,
      "imageBase64": "<jpeg base64, with or without data: URL prefix>",
      "mimeType": "image/jpeg"
    }
  ]
}
```

**Response:**

```json
{
  "fields": [
    {
      "id": "vision_1_0",
      "name": "Full Name",
      "type": "text",
      "pageNumber": 1,
      "rectNorm": { "x": 0.1, "y": 0.2, "w": 0.4, "h": 0.03 }
    }
  ]
}
```

`rectNorm` uses a top-left origin, normalized 0–1 to the page image.
