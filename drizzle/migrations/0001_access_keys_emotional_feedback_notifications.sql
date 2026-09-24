CREATE TABLE public.access_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT ALL ON public.access_keys TO service_role;
ALTER TABLE public.access_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.emotional_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.emotional_feedback TO authenticated;
GRANT ALL ON public.emotional_feedback TO service_role;
ALTER TABLE public.emotional_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert" ON public.emotional_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own or admin read" ON public.emotional_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read" ON public.in_app_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert" ON public.in_app_notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT ON public.in_app_notifications TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;