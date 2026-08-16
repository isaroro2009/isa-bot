CREATE TABLE public.studio_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Sin título',
  thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.studio_docs (
  project_id UUID NOT NULL PRIMARY KEY REFERENCES public.studio_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX studio_projects_user_idx ON public.studio_projects (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_projects TO authenticated;
GRANT ALL ON public.studio_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_docs TO authenticated;
GRANT ALL ON public.studio_docs TO service_role;

ALTER TABLE public.studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own studio projects" ON public.studio_projects
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own studio docs" ON public.studio_docs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER studio_projects_updated_at BEFORE UPDATE ON public.studio_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();