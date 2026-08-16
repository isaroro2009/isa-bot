
-- Enum for org roles
CREATE TYPE public.org_role AS ENUM ('org_owner', 'org_admin', 'org_member');

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  bot_name text NOT NULL DEFAULT 'IsaBot',
  primary_color text NOT NULL DEFAULT '#f9a8d4',
  secondary_color text NOT NULL DEFAULT '#c4b5fd',
  plan text NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  seats_limit integer NOT NULL DEFAULT 5,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Members
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'org_member',
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Invites
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL DEFAULT 'org_member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT ALL ON public.organization_invites TO service_role;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- B2B leads (landing form)
CREATE TABLE public.b2b_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  employees_range text,
  use_case text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_leads TO authenticated;
GRANT INSERT ON public.b2b_leads TO anon;
GRANT ALL ON public.b2b_leads TO service_role;
ALTER TABLE public.b2b_leads ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = _org AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org AND user_id = _user AND role = ANY(_roles)
  )
$$;

-- RLS: organizations
CREATE POLICY "Members view their orgs" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated create orgs" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners and admins update org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or global admin delete org" ON public.organizations
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- RLS: organization_members
CREATE POLICY "Members view roster" ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins add members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[])
    OR user_id = auth.uid()  -- allow self-join via accepted invite (server fn validates token)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owners/admins update members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins remove members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]) OR public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- RLS: organization_invites
CREATE POLICY "Owners/admins view invites" ON public.organization_invites
  FOR SELECT TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners/admins create invites" ON public.organization_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]));

CREATE POLICY "Owners/admins delete invites" ON public.organization_invites
  FOR DELETE TO authenticated
  USING (public.has_org_role(org_id, auth.uid(), ARRAY['org_owner','org_admin']::public.org_role[]));

-- RLS: b2b_leads
CREATE POLICY "Anyone can submit lead" ON public.b2b_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Global admins view leads" ON public.b2b_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Global admins update leads" ON public.b2b_leads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
