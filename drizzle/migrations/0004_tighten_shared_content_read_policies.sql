DROP POLICY IF EXISTS "Authenticated users can read tech news" ON public.tech_news;
CREATE POLICY "Registered users can read tech news"
ON public.tech_news
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can read the daily digest" ON public.tech_news_digest;
CREATE POLICY "Registered users can read the daily digest"
ON public.tech_news_digest
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "imported posts readable by signed in users" ON public.isaspace_imported;
CREATE POLICY "Registered users can read imported posts"
ON public.isaspace_imported
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "signed in read" ON public.in_app_notifications;
CREATE POLICY "Registered users can read notifications"
ON public.in_app_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
);