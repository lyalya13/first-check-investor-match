CREATE TABLE public.cala_search_cache (search_key text PRIMARY KEY, result jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), is_example boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.cala_search_cache TO anon, authenticated;
GRANT ALL ON public.cala_search_cache TO service_role;
ALTER TABLE public.cala_search_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public investor results" ON public.cala_search_cache FOR SELECT TO anon, authenticated USING (true);