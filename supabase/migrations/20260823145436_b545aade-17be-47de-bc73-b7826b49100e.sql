create schema if not exists private;

create table if not exists private.cron_keys (
  name text primary key,
  key text not null,
  created_at timestamptz not null default now()
);
revoke all on private.cron_keys from anon, authenticated;
grant all on private.cron_keys to service_role;

insert into private.cron_keys (name, key)
values ('inactivity', '17517951a27070a3298fa9b5caf242ab4cf6dc20634d8f3e')
on conflict (name) do update set key = excluded.key;

select cron.unschedule(jobid) from cron.job where jobname = 'isabot-inactivity-reminders';

select cron.schedule(
  'isabot-inactivity-reminders',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://project--8567fee6-efba-493a-9992-b46fab1eeaa1.lovable.app/api/public/hooks/inactivity-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select key from private.cron_keys where name = 'inactivity')
    ),
    body := '{}'::jsonb
  );
  $$
);