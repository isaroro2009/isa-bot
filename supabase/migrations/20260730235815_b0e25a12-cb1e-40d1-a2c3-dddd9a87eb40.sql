CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'idea',
  rating INTEGER NOT NULL DEFAULT 5,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own feedback insert" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own feedback select" ON public.feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin feedback update" ON public.feedback
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX feedback_created_at_idx ON public.feedback (created_at DESC);
CREATE INDEX feedback_user_idx ON public.feedback (user_id);