CREATE TABLE public.sales_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  niche text NOT NULL,
  city text NOT NULL,
  offer text NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['email','whatsapp'],
  daily_limit int NOT NULL DEFAULT 10,
  auto_send boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_campaigns TO authenticated;
GRANT ALL ON public.sales_campaigns TO service_role;
ALTER TABLE public.sales_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.sales_campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sales_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.sales_campaigns ON DELETE CASCADE,
  business_name text NOT NULL,
  website text,
  email text,
  phone text,
  address text,
  city text,
  niche text,
  source text NOT NULL DEFAULT 'openstreetmap',
  notes text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sales_prospects_unique_biz ON public.sales_prospects (user_id, lower(business_name), coalesce(city,''));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_prospects TO authenticated;
GRANT ALL ON public.sales_prospects TO service_role;
ALTER TABLE public.sales_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prospects" ON public.sales_prospects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sales_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.sales_prospects ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.sales_campaigns ON DELETE CASCADE,
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_messages TO authenticated;
GRANT ALL ON public.sales_messages TO service_role;
ALTER TABLE public.sales_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sales messages" ON public.sales_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);