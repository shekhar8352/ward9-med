begin;
create extension if not exists pgtap;
select plan(6);

-- LWW is exercised through a helper that bypasses auth for tests.
create or replace function app.test_lww_setup()
returns uuid
language plpgsql
as $$
declare
  hid uuid := '00000000-0000-4000-8000-000000000001';
  uid uuid := '00000000-0000-4000-8000-0000000000aa';
  pid uuid;
  aid uuid;
begin
  insert into auth.users (id, instance_id, aud, role, phone, encrypted_password, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '+910000000001', crypt('x', gen_salt('bf')), now(), now())
  on conflict (id) do nothing;
  insert into app.users (id, hospital_id, name, phone, role)
  values (uid, hid, 'Test Resident', '+910000000001', 'resident')
  on conflict (id) do nothing;
  insert into app.patients (hospital_id, name, age, sex, father_name, address, mobile)
  values (hid, 'Fixture Patient', 40, 'male', 'F', 'Addr', '9999999999')
  returning id into pid;
  insert into app.admissions (hospital_id, patient_id, status, current_stage, brought_by_name, brought_by_relation, is_mlc, ayushman_status, photo_consent)
  values (hid, pid, 'active', 'ward', 'B', 'son', false, 'none', true)
  returning id into aid;
  return aid;
end $$;

select lives_ok($$ select app.test_lww_setup() $$, 'fixture created');

select throws_ok(
  $$ delete from app.audit_log $$,
  'audit_log is append-only'
);

select throws_ok(
  $$ delete from app.admissions $$,
  'hard delete is disabled on admissions'
);

select * from finish();
rollback;
