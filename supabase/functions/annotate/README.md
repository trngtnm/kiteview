# annotate

Explains or summarizes a selected PDF phrase using OpenAI `gpt-4o-mini`. Used by the multi-word selection path in the reader.

## Prerequisites

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
2. A Supabase project linked: `supabase link --project-ref <your-ref>`
3. An OpenAI API key

## Secrets

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

(Same secret as `forms-detect`.)

## Deploy

```bash
supabase functions deploy annotate
```

## Client env

```
GPT_ENDPOINT_URL=https://YOUR_PROJECT.supabase.co/functions/v1/annotate
```

`GPT_ENDPOINT_URL` must point at **annotate**, not `forms-detect`.

## Request / response

**POST** body:

```json
{
  "selection_text": "due process of law",
  "page_number": 2,
  "annotation_type": "explain",
  "context": "optional surrounding paragraph text"
}
```

`annotation_type`: `explain` | `summarize` (legacy `paraphrase` → `explain`).

**Response:**

```json
{
  "content": "…",
  "explanation": "…",
  "paraphrase": "…",
  "annotation_type": "explain",
  "page_number": 2
}
```

`content` is the canonical field the client reads.
