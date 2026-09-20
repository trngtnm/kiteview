# annotate

Explains or summarizes a selected PDF phrase using OpenAI `gpt-4o-mini`. Used by the multi-word selection path in the reader.

Personalization:
- **Signed-in user JWT** in `Authorization` → loads `reading_preferences` (RLS) and tailors the system prompt
- Optional `custom_instructions` in the request body (guests) or stored on `reading_preferences` (signed-in)
- **Anon JWT** (guest) → intermediate / conversational defaults

The client never sends preference fields in the request body.

## Prerequisites

1. [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
2. A Supabase project linked: `supabase link --project-ref <ref>`
3. Schema applied: `supabase db push` (profiles + reading_preferences)
4. An OpenAI API key

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

Headers: `Authorization: Bearer <user access token or anon key>`, `apikey: <anon key>`.

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
