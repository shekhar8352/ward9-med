alter table app.hospitals enable row level security;
alter table app.invites enable row level security;
alter table app.users enable row level security;
alter table app.user_devices enable row level security;
alter table app.patients enable row level security;
alter table app.admissions enable row level security;
alter table app.admission_team enable row level security;
alter table app.checklist_items enable row level security;
alter table app.workflow_transitions enable row level security;
alter table app.checklist_entries enable row level security;
alter table app.attachments enable row level security;
alter table app.stage_transitions enable row level security;
alter table app.audit_log enable row level security;
alter table app.push_events enable row level security;
alter table app.access_log enable row level security;

create or replace function app.current_hospital_id()
returns uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select hospital_id from app.users where id = auth.uid()
$$;

create or replace function app.current_role()
returns app.user_role
language sql
stable
security definer
set search_path = app, public
as $$
  select role from app.users where id = auth.uid() and active
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.users where id = auth.uid() and active and role = 'admin'
  )
$$;

create or replace function app.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (select 1 from app.users where id = auth.uid() and active)
$$;

-- hospitals
create policy hospitals_select on app.hospitals
  for select to authenticated
  using (id = app.current_hospital_id());

-- users: colleagues in same hospital
create policy users_select on app.users
  for select to authenticated
  using (hospital_id = app.current_hospital_id() and app.is_active_user());

create policy users_update_admin on app.users
  for update to authenticated
  using (app.is_admin() and hospital_id = app.current_hospital_id())
  with check (app.is_admin() and hospital_id = app.current_hospital_id());

-- invites
create policy invites_admin_all on app.invites
  for all to authenticated
  using (app.is_admin() and hospital_id = app.current_hospital_id())
  with check (app.is_admin() and hospital_id = app.current_hospital_id());

-- devices
create policy devices_select_own on app.user_devices
  for select to authenticated
  using (user_id = auth.uid() or (app.is_admin() and hospital_id = app.current_hospital_id()));

create policy devices_insert_own on app.user_devices
  for insert to authenticated
  with check (user_id = auth.uid() and hospital_id = app.current_hospital_id());

create policy devices_update_own on app.user_devices
  for update to authenticated
  using (user_id = auth.uid() or app.is_admin())
  with check (hospital_id = app.current_hospital_id());

-- templates
create policy items_select on app.checklist_items
  for select to authenticated
  using (hospital_id = app.current_hospital_id() and app.is_active_user());

create policy items_admin_write on app.checklist_items
  for all to authenticated
  using (app.is_admin() and hospital_id = app.current_hospital_id())
  with check (app.is_admin() and hospital_id = app.current_hospital_id());

create policy transitions_select on app.workflow_transitions
  for select to authenticated
  using (hospital_id = app.current_hospital_id() and app.is_active_user());

create policy transitions_admin_write on app.workflow_transitions
  for all to authenticated
  using (app.is_admin() and hospital_id = app.current_hospital_id())
  with check (app.is_admin() and hospital_id = app.current_hospital_id());

-- patients / admissions
create policy patients_select on app.patients
  for select to authenticated
  using (
    hospital_id = app.current_hospital_id()
    and exists (select 1 from app.admissions a where a.patient_id = patients.id and app.can_access(a.id))
  );

create policy patients_insert on app.patients
  for insert to authenticated
  with check (hospital_id = app.current_hospital_id() and app.is_active_user());

create policy patients_update on app.patients
  for update to authenticated
  using (hospital_id = app.current_hospital_id() and app.is_active_user())
  with check (hospital_id = app.current_hospital_id());

create policy admissions_select on app.admissions
  for select to authenticated
  using (app.can_access(id));

create policy admissions_insert on app.admissions
  for insert to authenticated
  with check (hospital_id = app.current_hospital_id() and app.is_active_user());

create policy admissions_update on app.admissions
  for update to authenticated
  using (app.can_access(id))
  with check (hospital_id = app.current_hospital_id());

create policy team_select on app.admission_team
  for select to authenticated
  using (app.can_access(admission_id));

create policy team_insert on app.admission_team
  for insert to authenticated
  with check (app.can_access(admission_id) or (
    hospital_id = app.current_hospital_id() and user_id = auth.uid()
  ));

create policy team_update on app.admission_team
  for update to authenticated
  using (app.can_access(admission_id));

create policy entries_select on app.checklist_entries
  for select to authenticated
  using (app.can_access(admission_id));

create policy entries_insert on app.checklist_entries
  for insert to authenticated
  with check (app.can_access(admission_id) and done_by = auth.uid());

create policy entries_update on app.checklist_entries
  for update to authenticated
  using (app.can_access(admission_id))
  with check (app.can_access(admission_id) and done_by = auth.uid());

create policy attachments_select on app.attachments
  for select to authenticated
  using (app.can_access(admission_id));

create policy attachments_insert on app.attachments
  for insert to authenticated
  with check (app.can_access(admission_id) and uploaded_by = auth.uid());

create policy attachments_update on app.attachments
  for update to authenticated
  using (app.can_access(admission_id));

create policy stage_tr_select on app.stage_transitions
  for select to authenticated
  using (app.can_access(admission_id));

create policy stage_tr_insert on app.stage_transitions
  for insert to authenticated
  with check (app.can_access(admission_id) and by_user = auth.uid());

-- audit: admins only, no update/delete policies
create policy audit_select_admin on app.audit_log
  for select to authenticated
  using (app.is_admin() and hospital_id = app.current_hospital_id());

create policy access_log_admin on app.access_log
  for select to authenticated
  using (app.is_admin() and hospital_id = app.current_hospital_id());

create policy access_log_insert on app.access_log
  for insert to authenticated
  with check (user_id = auth.uid() and hospital_id = app.current_hospital_id());

create policy push_select on app.push_events
  for select to authenticated
  using (hospital_id = app.current_hospital_id() and auth.uid() = any (target_user_ids));

revoke update, delete on app.audit_log from authenticated, anon;
revoke delete on app.patients, app.admissions, app.admission_team,
  app.checklist_entries, app.attachments, app.stage_transitions from authenticated, anon;

grant usage on schema app to authenticated, anon, service_role;
grant select, insert, update on all tables in schema app to authenticated;
grant select on app.audit_log to authenticated;
grant insert on app.audit_log to service_role;
grant execute on all functions in schema app to authenticated;

-- JWT custom access token hook (Postgres)
create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  uid uuid;
  rec app.users%rowtype;
  inv app.invites%rowtype;
  phone text;
begin
  claims := event -> 'claims';
  uid := (event ->> 'user_id')::uuid;
  select * into rec from app.users where id = uid;
  if not found then
    phone := event -> 'claims' ->> 'phone';
    if phone is null then
      phone := event -> 'user' ->> 'phone';
    end if;
    select * into inv from app.invites
    where regexp_replace(invites.phone, '\D', '', 'g') = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
      and accepted_at is null
    limit 1;
    if found then
      insert into app.users (id, hospital_id, name, phone, role)
      values (uid, inv.hospital_id, inv.name, inv.phone, inv.role)
      returning * into rec;
      update app.invites set accepted_at = now() where id = inv.id;
    end if;
  end if;
  if rec.id is null then
    claims := jsonb_set(claims, '{app_role}', '"none"');
    claims := jsonb_set(claims, '{hospital_id}', 'null');
  else
    if not rec.active then
      claims := jsonb_set(claims, '{app_role}', '"deactivated"');
    else
      claims := jsonb_set(claims, '{app_role}', to_jsonb(rec.role::text));
    end if;
    claims := jsonb_set(claims, '{role}', to_jsonb(rec.role::text));
    claims := jsonb_set(claims, '{hospital_id}', to_jsonb(rec.hospital_id::text));
  end if;
  event := jsonb_set(event, '{claims}', claims);
  return event;
end $$;

grant execute on function app.custom_access_token_hook to supabase_auth_admin;
grant usage on schema app to supabase_auth_admin;
