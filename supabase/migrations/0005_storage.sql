insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-files',
  'patient-files',
  false,
  2000000,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

create or replace function app.storage_admission_id(name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(name, '/', 2), '')::uuid
$$;

create or replace function app.storage_hospital_id(name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(name, '/', 1), '')::uuid
$$;

create policy patient_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'patient-files'
    and app.can_access(app.storage_admission_id(name))
  );

create policy patient_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'patient-files'
    and app.can_access(app.storage_admission_id(name))
    and app.storage_hospital_id(name) = app.current_hospital_id()
  );

create policy patient_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'patient-files'
    and app.can_access(app.storage_admission_id(name))
  );
