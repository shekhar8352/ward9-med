create extension if not exists pgcrypto;

create schema if not exists app;

create type app.user_role as enum ('resident', 'consultant', 'admin');
create type app.admission_status as enum ('active', 'discharged', 'cancelled');
create type app.stage as enum (
  'registration', 'ward', 'fitness', 'pre_ot', 'post_op', 'discharge'
);
create type app.ayushman_status as enum ('none', 'applied', 'not_applied');
create type app.wound_type as enum ('compound', 'non_compound');
create type app.sex as enum ('male', 'female', 'other');
create type app.upload_status as enum ('pending', 'uploading', 'uploaded', 'failed');
create type app.field_type as enum (
  'bool', 'text', 'number', 'enum', 'multi_enum', 'date', 'photo', 'note_photo'
);

create table app.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Kolkata',
  visibility_mode text not null default 'ward'
    check (visibility_mode in ('ward', 'team')),
  sync_discharged_hours int not null default 48,
  min_client_version text not null default '1.0.0',
  grievance_contact text,
  created_at timestamptz not null default now()
);

create table app.invites (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  name text not null,
  phone text not null,
  role app.user_role not null,
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (hospital_id, phone)
);

create table app.users (
  id uuid primary key references auth.users (id) on delete restrict,
  hospital_id uuid not null references app.hospitals (id),
  name text not null,
  phone text not null,
  role app.user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hospital_id, phone)
);

create table app.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app.users (id),
  hospital_id uuid not null references app.hospitals (id),
  device_label text,
  expo_push_token text,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table app.patients (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  name text not null,
  age int not null check (age >= 0 and age < 130),
  sex app.sex not null,
  father_name text,
  address text,
  mobile text,
  past_history text,
  abha_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.admissions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  patient_id uuid not null references app.patients (id),
  status app.admission_status not null default 'active',
  current_stage app.stage not null default 'registration',
  admitted_at timestamptz not null default now(),
  brought_by_name text,
  brought_by_relation text,
  brought_by_phone text,
  is_mlc boolean,
  ayushman_status app.ayushman_status,
  wound_type app.wound_type,
  planned_procedures text[] not null default '{}',
  surgery_date date,
  photo_consent boolean,
  photo_consent_by uuid references app.users (id),
  photo_consent_at timestamptz,
  fitness_attempt int not null default 1,
  discharged_at timestamptz,
  cancel_reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users (id),
  device_id uuid
);

create table app.admission_team (
  admission_id uuid not null references app.admissions (id),
  user_id uuid not null references app.users (id),
  hospital_id uuid not null references app.hospitals (id),
  team_role text not null default 'member',
  assigned_at timestamptz not null default now(),
  primary key (admission_id, user_id)
);

create table app.checklist_items (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  stage app.stage not null,
  item_key text not null,
  label text not null,
  help_text text,
  field_type app.field_type not null,
  required boolean not null default true,
  applies_when jsonb,
  options jsonb,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (hospital_id, item_key)
);

create table app.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  from_stage app.stage not null,
  to_stage app.stage not null,
  guard jsonb,
  requires_reason boolean not null default false,
  label text not null,
  completes_admission boolean not null default false,
  unique (hospital_id, from_stage, to_stage, completes_admission)
);

create table app.checklist_entries (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  admission_id uuid not null references app.admissions (id),
  item_key text not null,
  value jsonb not null,
  done_by uuid not null references app.users (id),
  done_at timestamptz not null,
  updated_at timestamptz not null,
  device_id uuid not null,
  client_mutation_id uuid not null,
  unique (admission_id, item_key)
);

create table app.attachments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  admission_id uuid not null references app.admissions (id),
  entry_id uuid references app.checklist_entries (id),
  kind text not null,
  local_only boolean not null default true,
  storage_path text,
  byte_size int,
  upload_status app.upload_status not null default 'pending',
  uploaded_by uuid not null references app.users (id),
  created_at timestamptz not null default now()
);

create table app.stage_transitions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  admission_id uuid not null references app.admissions (id),
  from_stage app.stage not null,
  to_stage app.stage not null,
  reason text,
  override boolean not null default false,
  by_user uuid not null references app.users (id),
  at timestamptz not null default now(),
  device_id uuid not null
);

create table app.audit_log (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  who uuid,
  action text not null,
  table_name text not null,
  row_id uuid,
  old_row jsonb,
  new_row jsonb,
  at timestamptz not null default now()
);

create table app.push_events (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references app.hospitals (id),
  admission_id uuid references app.admissions (id),
  event_key text not null,
  title text not null,
  body text not null,
  target_user_ids uuid[] not null default '{}',
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create table app.access_log (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  user_id uuid,
  admission_id uuid,
  action text not null,
  at timestamptz not null default now()
);

create index admissions_active_idx
  on app.admissions (hospital_id, current_stage)
  where status = 'active';
create index entries_admission_idx
  on app.checklist_entries (admission_id, item_key);
create index team_user_idx on app.admission_team (user_id);
create index attachments_pending_idx
  on app.attachments (admission_id, upload_status);
create index transitions_admission_idx
  on app.stage_transitions (admission_id, at);
create index audit_row_idx
  on app.audit_log (table_name, row_id, at);
create index invites_phone_idx on app.invites (phone);
create index devices_user_idx on app.user_devices (user_id);
