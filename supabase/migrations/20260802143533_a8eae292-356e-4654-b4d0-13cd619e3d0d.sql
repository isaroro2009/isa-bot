DROP POLICY IF EXISTS "houses readable" ON public.oryon_houses;
CREATE POLICY "own house select" ON public.oryon_houses FOR SELECT TO authenticated USING (auth.uid() = user_id);