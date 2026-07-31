CREATE TABLE public.saved_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  ascent INTEGER NOT NULL DEFAULT 0,
  est_minutes INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT '',
  route JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_routes TO authenticated;
GRANT ALL ON public.saved_routes TO service_role;
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own saved routes" ON public.saved_routes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX saved_routes_user_created_idx ON public.saved_routes (user_id, created_at DESC);