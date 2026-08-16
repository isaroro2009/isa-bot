-- 1) market_applications: validate job existence/state on insert
DROP POLICY IF EXISTS "applications applicant insert" ON public.market_applications;
CREATE POLICY "applications applicant insert"
ON public.market_applications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.market_jobs j
    WHERE j.id = market_applications.job_id
      AND j.status = 'open'
      AND j.user_id <> auth.uid()
  )
);

-- 2) email_log: append-only via service role, no client write path
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.email_log FROM anon, authenticated;
REVOKE SELECT ON public.email_log FROM anon;
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;