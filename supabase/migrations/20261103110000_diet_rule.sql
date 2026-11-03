-- Each person's own diet, one or two lines. Empty = the default "No cheat meals · No alcohol".
alter table public.people
  add column if not exists diet text not null default '' check (char_length(diet) <= 160);
