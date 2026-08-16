CREATE TABLE public.oryon_avatars (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nick TEXT NOT NULL DEFAULT 'Explorador',
  skin TEXT NOT NULL DEFAULT '#f3c8a8',
  hair TEXT NOT NULL DEFAULT '#3b2a4a',
  hair_style TEXT NOT NULL DEFAULT 'long',
  outfit TEXT NOT NULL DEFAULT '#f472b6',
  pants TEXT NOT NULL DEFAULT '#7c5cc4',
  accessory TEXT NOT NULL DEFAULT 'none',
  active_car TEXT,
  active_pet TEXT,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_z REAL NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oryon_avatars TO authenticated;
GRANT ALL ON public.oryon_avatars TO service_role;
ALTER TABLE public.oryon_avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own avatar" ON public.oryon_avatars FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.oryon_houses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lot INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT 'Mi casa',
  shape TEXT NOT NULL DEFAULT 'dome',
  wall_color TEXT NOT NULL DEFAULT '#fdf7fb',
  roof_color TEXT NOT NULL DEFAULT '#f472b6',
  door_color TEXT NOT NULL DEFAULT '#7c5cc4',
  decorations TEXT[] NOT NULL DEFAULT '{}',
  furniture JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (lot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oryon_houses TO authenticated;
GRANT ALL ON public.oryon_houses TO service_role;
ALTER TABLE public.oryon_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "houses readable" ON public.oryon_houses FOR SELECT TO authenticated USING (true);
CREATE POLICY "own house insert" ON public.oryon_houses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own house update" ON public.oryon_houses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own house delete" ON public.oryon_houses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.oryon_catalog (
  code TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🚗',
  color TEXT NOT NULL DEFAULT '#f472b6',
  cost INTEGER NOT NULL DEFAULT 0,
  premium BOOLEAN NOT NULL DEFAULT false,
  speed REAL NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.oryon_catalog TO authenticated;
GRANT ALL ON public.oryon_catalog TO service_role;
ALTER TABLE public.oryon_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog readable" ON public.oryon_catalog FOR SELECT TO authenticated USING (active);

CREATE TABLE public.oryon_garage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL REFERENCES public.oryon_catalog(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_code)
);
GRANT SELECT, INSERT, DELETE ON public.oryon_garage TO authenticated;
GRANT ALL ON public.oryon_garage TO service_role;
ALTER TABLE public.oryon_garage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own garage" ON public.oryon_garage FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.oryon_quests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_code TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_code)
);
GRANT SELECT, INSERT ON public.oryon_quests TO authenticated;
GRANT ALL ON public.oryon_quests TO service_role;
ALTER TABLE public.oryon_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quests" ON public.oryon_quests FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER oryon_avatars_updated BEFORE UPDATE ON public.oryon_avatars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER oryon_houses_updated BEFORE UPDATE ON public.oryon_houses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.oryon_catalog (code, kind, title, emoji, color, cost, premium, speed, sort_order) VALUES
  ('car_pastel', 'car', 'Pastelito', '🚗', '#f9a8d4', 0, false, 1.6, 1),
  ('car_scooter', 'car', 'Scooter Oryon', '🛵', '#c4b5fd', 20, false, 1.5, 2),
  ('car_bici', 'car', 'Bici Nube', '🚲', '#a7f3d0', 15, false, 1.4, 3),
  ('car_taxi', 'car', 'Taxi Rosa', '🚕', '#fbbf24', 40, false, 1.8, 4),
  ('car_van', 'car', 'Van Creativa', '🚐', '#93c5fd', 60, false, 1.7, 5),
  ('car_sport', 'car', 'Oryon Sport', '🏎️', '#ef4444', 120, false, 2.2, 6),
  ('car_neon', 'car', 'Neón Premium', '🚙', '#a855f7', 0, true, 2.4, 7),
  ('car_hover', 'car', 'HoverIsa', '🛸', '#22d3ee', 0, true, 2.8, 8),
  ('car_royal', 'car', 'Royal Roro', '🚘', '#f472b6', 0, true, 2.6, 9),
  ('car_star', 'car', 'Estrella Fugaz', '✨', '#fde68a', 0, true, 3.0, 10),
  ('pet_gatito', 'pet', 'Gatito Nube', '🐱', '#fbcfe8', 30, false, 1, 11),
  ('pet_perrito', 'pet', 'Perrito Pastel', '🐶', '#fed7aa', 30, false, 1, 12),
  ('pet_conejo', 'pet', 'Conejo Lila', '🐰', '#ddd6fe', 45, false, 1, 13),
  ('pet_robot', 'pet', 'Mini IsaBot', '🤖', '#c4b5fd', 0, true, 1, 14),
  ('pet_dragon', 'pet', 'Dragoncito', '🐲', '#86efac', 0, true, 1, 15),
  ('pet_unicornio', 'pet', 'Unicornio Oryon', '🦄', '#f9a8d4', 0, true, 1, 16);