-- Optional free-text instructions that annotate includes in the LLM system prompt.

alter table public.reading_preferences
  add column if not exists custom_instructions text not null default '';
