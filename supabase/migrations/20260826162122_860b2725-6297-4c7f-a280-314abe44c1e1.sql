CREATE TABLE public.isaspace_imported (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'mastodon',
  external_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  author_avatar TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
GRANT SELECT ON public.isaspace_imported TO authenticated;
GRANT ALL ON public.isaspace_imported TO service_role;
ALTER TABLE public.isaspace_imported ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imported posts readable by signed in users"
  ON public.isaspace_imported FOR SELECT TO authenticated USING (true);

CREATE TABLE public.mentor_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  expertise TEXT NOT NULL,
  experience TEXT NOT NULL,
  links TEXT,
  contact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mentor_applications TO authenticated;
GRANT ALL ON public.mentor_applications TO service_role;
ALTER TABLE public.mentor_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mentor application select"
  ON public.mentor_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own mentor application insert"
  ON public.mentor_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update mentor applications"
  ON public.mentor_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER mentor_applications_updated_at
  BEFORE UPDATE ON public.mentor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();