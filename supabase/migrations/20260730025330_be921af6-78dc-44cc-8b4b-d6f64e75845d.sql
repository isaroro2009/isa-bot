ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.isaspace_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.isaspace_posts TO authenticated;
GRANT ALL ON public.isaspace_posts TO service_role;
ALTER TABLE public.isaspace_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed can read posts" ON public.isaspace_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own posts" ON public.isaspace_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND char_length(trim(content)) BETWEEN 1 AND 2000);
CREATE POLICY "Users delete own posts" ON public.isaspace_posts FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.isaspace_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.isaspace_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.isaspace_likes TO authenticated;
GRANT ALL ON public.isaspace_likes TO service_role;
ALTER TABLE public.isaspace_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed can read likes" ON public.isaspace_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like as themselves" ON public.isaspace_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own like" ON public.isaspace_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.isaspace_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.isaspace_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.isaspace_comments TO authenticated;
GRANT ALL ON public.isaspace_comments TO service_role;
ALTER TABLE public.isaspace_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authed can read comments" ON public.isaspace_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own comments" ON public.isaspace_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND char_length(trim(content)) BETWEEN 1 AND 800);
CREATE POLICY "Users delete own comments" ON public.isaspace_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));