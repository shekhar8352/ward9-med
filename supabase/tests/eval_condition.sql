-- Shared fixtures with packages/domain/fixtures/rules.json
begin;
create extension if not exists pgtap;
select plan(11);

select ok(
  app.eval_condition(null, '{"patient":{"age":40},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb),
  'null condition is true'
);

select ok(
  app.eval_condition(
    '{"op":"eq","path":"patient.age","value":40}'::jsonb,
    '{"patient":{"age":40},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb
  ),
  'eq age'
);

select ok(
  app.eval_condition(
    '{"op":"gt","path":"patient.age","value":30}'::jsonb,
    '{"patient":{"age":31},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb
  ),
  'gt 30'
);

select ok(
  app.eval_condition(
    '{"op":"gte","path":"patient.age","value":18}'::jsonb,
    '{"patient":{"age":18},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb
  ),
  'gte 18 inclusive'
);

select ok(
  app.eval_condition(
    '{"op":"lt","path":"patient.age","value":18}'::jsonb,
    '{"patient":{"age":17},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb
  ),
  'lt 18'
);

select ok(
  app.eval_condition(
    '{"op":"contains","path":"admission.planned_procedures","value":"THR"}'::jsonb,
    '{"patient":{"age":45},"admission":{"planned_procedures":["THR"]},"entries":{},"today":"2026-11-11"}'::jsonb
  ),
  'contains THR'
);

select ok(
  app.eval_condition(
    '{"op":"in","path":"admission.ayushman_status","value":["none","not_applied"]}'::jsonb,
    '{"patient":{},"admission":{"ayushman_status":"none"},"entries":{},"today":"2026-11-11"}'::jsonb
  ),
  'in ayushman'
);

select throws_ok(
  $$ select app.eval_condition('{"op":"xor","path":"patient.age","value":1}'::jsonb,
     '{"patient":{"age":1},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb) $$,
  'unknown operator: xor'
);

select throws_ok(
  $$ select app.eval_condition('{"op":"eq","path":"patient.missing","value":1}'::jsonb,
     '{"patient":{"age":1},"admission":{},"entries":{},"today":"2026-11-11"}'::jsonb) $$,
  'unknown path: patient.missing'
);

select ok(
  app.eval_condition(
    '{"op":"eq","path":"entries.blood.cleared","value":"fine"}'::jsonb,
    '{"patient":{},"admission":{},"entries":{"blood.cleared":"fine"},"today":"2026-11-11"}'::jsonb
  ),
  'entries dotted key'
);

select ok(
  app.eval_condition(
    '{"op":"eq","path":"entries.__fitness_any__","value":"unfit"}'::jsonb,
    '{"patient":{},"admission":{},"entries":{"__fitness_any__":"unfit"},"today":"2026-11-11"}'::jsonb
  ),
  'fitness_any'
);

select * from finish();
rollback;
