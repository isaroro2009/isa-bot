CREATE OR REPLACE FUNCTION public.market_applications_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS DISTINCT FROM OLD.job_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'cannot reassign application';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message
     OR NEW.contact IS DISTINCT FROM OLD.contact THEN
    RAISE EXCEPTION 'cannot modify applicant content';
  END IF;
  IF NEW.status NOT IN ('pending','accepted','rejected','new','review') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS market_applications_guard_trg ON public.market_applications;
CREATE TRIGGER market_applications_guard_trg
BEFORE UPDATE ON public.market_applications
FOR EACH ROW EXECUTE FUNCTION public.market_applications_guard();