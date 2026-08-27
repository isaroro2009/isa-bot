CREATE TABLE IF NOT EXISTS public.integration_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT ALL ON public.integration_settings TO service_role;

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage integration settings" ON public.integration_settings;
CREATE POLICY "admins manage integration settings"
ON public.integration_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));