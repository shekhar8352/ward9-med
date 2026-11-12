begin;
create extension if not exists pgtap;
select plan(4);

select is(
  (select count(*) > 0 from pg_policies where schemaname = 'app' and tablename = 'admissions'),
  true,
  'admissions has RLS policies'
);

select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'app' and c.relname = 'audit_log'),
  true,
  'audit_log RLS on'
);

select is(
  (select count(*) from pg_policies where schemaname = 'app' and tablename = 'audit_log' and cmd in ('UPDATE', 'DELETE')),
  0::bigint,
  'audit_log has no update or delete policies'
);

select ok(
  exists(select 1 from pg_proc where proname = 'can_access' and pronamespace = 'app'::regnamespace),
  'can_access exists'
);

select * from finish();
rollback;
