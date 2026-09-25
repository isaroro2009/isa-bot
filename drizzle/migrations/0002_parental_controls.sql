CREATE TABLE public.parental_controls (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  guide_mode text NOT NULL DEFAULT 'libre' CHECK (guide_mode IN ('academico','libre')),
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parental_controls TO authenticated;
GRANT ALL ON public.parental_controls TO service_role;
ALTER TABLE public.parental_controls ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON public.parental_controls FROM authenticated;
GRANT SELECT (user_id, guide_mode) ON public.parental_controls TO authenticated;
CREATE POLICY "Own row readable" ON public.parental_controls FOR SELECT TO authenticated USING (auth.uid() = user_id);