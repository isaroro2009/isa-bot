
CREATE TABLE public.weekly_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_key TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'wallpaper',
  title TEXT NOT NULL,
  message TEXT,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_weekly_gifts_week ON public.weekly_gifts(week_key);
CREATE INDEX idx_weekly_gifts_target ON public.weekly_gifts(target_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_gifts TO authenticated;
GRANT ALL ON public.weekly_gifts TO service_role;

ALTER TABLE public.weekly_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own or global gifts"
  ON public.weekly_gifts FOR SELECT
  TO authenticated
  USING (target_user_id IS NULL OR target_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage gifts insert"
  ON public.weekly_gifts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage gifts update"
  ON public.weekly_gifts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage gifts delete"
  ON public.weekly_gifts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_weekly_gifts_updated_at
  BEFORE UPDATE ON public.weekly_gifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
