-- 🎂📰 Emails de ciclo de vida: cumpleaños y resumen semanal
alter table public.profiles
  add column if not exists birthday date,
  add column if not exists last_birthday_email_year integer,
  add column if not exists last_weekly_digest_at timestamptz;

create or replace function public.ibc_admin_grant(_user_id uuid, _amount integer, _reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare _bal integer;
begin
  if _amount is null or _amount <= 0 or _amount > 1000 then
    raise exception 'monto invalido';
  end if;
  insert into public.ibc_wallets (user_id, balance)
  values (_user_id, _amount)
  on conflict (user_id) do update set balance = public.ibc_wallets.balance + _amount
  returning balance into _bal;

  insert into public.ibc_transactions (user_id, amount, type, description)
  values (_user_id, _amount, 'earn', coalesce(left(_reason, 120), 'Regalo'));

  return _bal;
end;
$fn$;

revoke all on function public.ibc_admin_grant(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.ibc_admin_grant(uuid, integer, text) to service_role;

insert into private.cron_keys (name, key)
values
  ('birthday', '17517951a27070a3298fa9b5caf242ab4cf6dc20634d8f3e'),
  ('weekly_digest', '17517951a27070a3298fa9b5caf242ab4cf6dc20634d8f3e')
on conflict (name) do update set key = excluded.key;

select cron.unschedule(jobid) from cron.job where jobname in ('isabot-birthday-greetings', 'isabot-weekly-digest');

select cron.schedule(
  'isabot-birthday-greetings',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://project--8567fee6-efba-493a-9992-b46fab1eeaa1.lovable.app/api/public/hooks/birthday-greetings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select key from private.cron_keys where name = 'birthday')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'isabot-weekly-digest',
  '0 14 * * 1',
  $$
  select net.http_post(
    url := 'https://project--8567fee6-efba-493a-9992-b46fab1eeaa1.lovable.app/api/public/hooks/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select key from private.cron_keys where name = 'weekly_digest')
    ),
    body := '{}'::jsonb
  );
  $$
);