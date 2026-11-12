-- Plain SQL assertions that do not require pgTAP. Run against a migrated database:
--   psql "$SUPABASE_DB_URL" -f scripts/sql-tests.sql

\set ON_ERROR_STOP on

do $$
begin
  if not app.eval_condition(null, '{"patient":{"age":40},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb) then
    raise exception 'null condition should be true';
  end if;
  if not app.eval_condition(
    '{"op":"gte","path":"patient.age","value":18}'::jsonb,
    '{"patient":{"age":18},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb
  ) then
    raise exception 'age 18 should match gte 18';
  end if;
  begin
    perform app.eval_condition('{"op":"xor","path":"patient.age","value":1}'::jsonb,
      '{"patient":{"age":1},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb);
    raise exception 'xor should throw';
  exception when others then
    if sqlerrm not like 'unknown operator%' then
      raise;
    end if;
  end;
  raise notice 'eval_condition fixtures passed';
end $$;
