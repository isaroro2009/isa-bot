CREATE TABLE public.market_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'otros',
  price_from numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  delivery_days integer NOT NULL DEFAULT 3,
  contact text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_services TO authenticated;
GRANT ALL ON public.market_services TO service_role;
ALTER TABLE public.market_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services published readable" ON public.market_services
  FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "services owner read" ON public.market_services
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "services owner insert" ON public.market_services
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "services owner update" ON public.market_services
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "services owner delete" ON public.market_services
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER market_services_updated_at BEFORE UPDATE ON public.market_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.market_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'otros',
  budget numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  contact text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_jobs TO authenticated;
GRANT ALL ON public.market_jobs TO service_role;
ALTER TABLE public.market_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs open readable" ON public.market_jobs
  FOR SELECT TO authenticated USING (status = 'open');
CREATE POLICY "jobs owner read" ON public.market_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "jobs owner insert" ON public.market_jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs owner update" ON public.market_jobs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs owner delete" ON public.market_jobs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER market_jobs_updated_at BEFORE UPDATE ON public.market_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.market_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.market_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_applications TO authenticated;
GRANT ALL ON public.market_applications TO service_role;
ALTER TABLE public.market_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications applicant read" ON public.market_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "applications job owner read" ON public.market_applications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.market_jobs j WHERE j.id = job_id AND j.user_id = auth.uid())
  );
CREATE POLICY "applications applicant insert" ON public.market_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applications job owner update" ON public.market_applications
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.market_jobs j WHERE j.id = job_id AND j.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.market_jobs j WHERE j.id = job_id AND j.user_id = auth.uid())
  );
CREATE POLICY "applications applicant delete" ON public.market_applications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER market_applications_updated_at BEFORE UPDATE ON public.market_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();