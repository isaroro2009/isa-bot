CREATE TABLE public.tech_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'web',
  topic TEXT NOT NULL DEFAULT 'general',
  summary TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX tech_news_published_idx ON public.tech_news (published_at DESC);

GRANT SELECT ON public.tech_news TO authenticated;
GRANT ALL ON public.tech_news TO service_role;

ALTER TABLE public.tech_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tech news"
  ON public.tech_news FOR SELECT TO authenticated USING (true);

CREATE TABLE public.tech_news_digest (
  day DATE NOT NULL PRIMARY KEY,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tech_news_digest TO authenticated;
GRANT ALL ON public.tech_news_digest TO service_role;

ALTER TABLE public.tech_news_digest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read the daily digest"
  ON public.tech_news_digest FOR SELECT TO authenticated USING (true);