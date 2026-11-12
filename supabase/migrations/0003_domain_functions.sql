create or replace function app.me()
returns app.users
language sql
stable
security definer
set search_path = app, public
as $$
  select * from app.users where id = auth.uid()
$$;

create or replace function app.can_access(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1
    from app.admissions a
    join app.users me on me.id = auth.uid() and me.active
    join app.hospitals h on h.id = a.hospital_id
    where a.id = aid
      and a.hospital_id = me.hospital_id
      and (
        me.role = 'admin'
        or (
          a.status = 'active'
          and (
            h.visibility_mode = 'ward'
            or exists (
              select 1 from app.admission_team t
              where t.admission_id = a.id and t.user_id = me.id
            )
          )
        )
        or (
          a.status = 'discharged'
          and a.discharged_at > now() - make_interval(hours => h.sync_discharged_hours)
          and (
            h.visibility_mode = 'ward'
            or exists (
              select 1 from app.admission_team t
              where t.admission_id = a.id and t.user_id = me.id
            )
          )
        )
      )
  );
$$;

create or replace function app.build_eval_context(p_admission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  a app.admissions%rowtype;
  p app.patients%rowtype;
  entries_map jsonb := '{}'::jsonb;
  rec record;
  fitness_any text;
  pending_n int := 0;
  unfit_n int := 0;
  fit_n int := 0;
  ctx jsonb;
  item_applies boolean;
begin
  select * into a from app.admissions where id = p_admission_id;
  if not found then
    raise exception 'admission not found';
  end if;
  select * into p from app.patients where id = a.patient_id;
  for rec in
    select e.item_key, e.value
    from app.checklist_entries e
    where e.admission_id = p_admission_id
  loop
    entries_map := entries_map || jsonb_build_object(rec.item_key, rec.value);
    if jsonb_typeof(rec.value) = 'object' then
      entries_map := entries_map || (
        select coalesce(jsonb_object_agg(rec.item_key || '.' || key, value), '{}'::jsonb)
        from jsonb_each(rec.value)
      );
    end if;
    if rec.item_key = 'blood.report' then
      entries_map := entries_map || jsonb_build_object(
        'blood.cleared',
        coalesce(rec.value -> 'cleared', rec.value -> 'status')
      );
    end if;
  end loop;

  ctx := jsonb_build_object(
    'patient', jsonb_build_object('age', p.age, 'sex', p.sex, 'name', p.name),
    'admission', jsonb_build_object(
      'is_mlc', a.is_mlc,
      'ayushman_status', a.ayushman_status,
      'wound_type', a.wound_type,
      'planned_procedures', to_jsonb(a.planned_procedures),
      'current_stage', a.current_stage,
      'surgery_date', a.surgery_date,
      'status', a.status
    ),
    'entries', entries_map,
    'today', to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')
  );

  for rec in
    select i.item_key, i.applies_when, i.active
    from app.checklist_items i
    where i.hospital_id = a.hospital_id
      and i.stage = 'fitness'
      and i.active
      and i.item_key like 'fitness.%'
  loop
    begin
      item_applies := app.eval_condition(rec.applies_when, ctx);
    exception when others then
      item_applies := false;
    end;
    if item_applies then
      if (entries_map -> rec.item_key ->> 'status') = 'unfit'
         or (entries_map -> rec.item_key ->> 'value') = 'unfit' then
        unfit_n := unfit_n + 1;
      elsif (entries_map -> rec.item_key ->> 'status') = 'fit'
         or (entries_map -> rec.item_key ->> 'value') = 'fit' then
        fit_n := fit_n + 1;
      else
        pending_n := pending_n + 1;
      end if;
    end if;
  end loop;

  if pending_n + unfit_n + fit_n = 0 then
    fitness_any := null;
  elsif pending_n > 0 then
    fitness_any := 'pending';
  elsif unfit_n > 0 then
    fitness_any := 'unfit';
  else
    fitness_any := 'fit';
  end if;

  ctx := jsonb_set(ctx, '{entries,__fitness_any__}', to_jsonb(fitness_any));
  return ctx;
end $$;

create or replace function app.item_complete(p_item app.checklist_items, p_value jsonb, p_ctx jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  surgery date;
  today date;
  due date;
  offset_days int;
begin
  if p_item.item_key in ('dressing.day2', 'dressing.day4') then
    offset_days := case when p_item.item_key = 'dressing.day2' then 2 else 4 end;
    if coalesce((p_value ->> 'done')::boolean, (p_value ->> 'value')::boolean, false) then
      return true;
    end if;
    if coalesce((p_value ->> 'waived')::boolean, false) then
      return coalesce(nullif(p_value ->> 'reason', ''), nullif(p_value ->> 'waive_reason', '')) is not null;
    end if;
    if p_ctx #>> '{admission,surgery_date}' is null then
      return true;
    end if;
    surgery := (p_ctx #>> '{admission,surgery_date}')::date;
    today := (p_ctx ->> 'today')::date;
    due := surgery + offset_days;
    return today < due;
  end if;

  if p_item.item_key = 'blood.report' then
    return p_value ->> 'cleared' in ('fine', 'not_fine');
  end if;

  if p_item.item_key like 'fitness.%' then
    return coalesce(p_value ->> 'status', p_value ->> 'value') in ('fit', 'unfit', 'pending');
  end if;

  if p_item.item_key = 'dressing.daily' then
    return (p_value ? 'done') or (p_value ? 'value');
  end if;

  case p_item.field_type
    when 'bool' then
      return (p_value ->> 'value') in ('true', 'false') or (p_value ->> 'done') in ('true', 'false');
    when 'text' then
      return coalesce(nullif(p_value ->> 'value', ''), nullif(p_value ->> 'text', '')) is not null;
    when 'number' then
      return (p_value ->> 'value') is not null;
    when 'enum' then
      return coalesce(p_value ->> 'value', '') <> '';
    when 'multi_enum' then
      return jsonb_typeof(p_value -> 'value') = 'array' and jsonb_array_length(p_value -> 'value') > 0;
    when 'date' then
      return coalesce(p_value ->> 'value', '') <> '';
    when 'photo' then
      return coalesce(p_value ->> 'attachment_id', p_value ->> 'photo_id', '') <> ''
        or coalesce((p_value ->> 'not_taken')::boolean, false)
        or (jsonb_typeof(p_value -> 'attachment_ids') = 'array'
            and jsonb_array_length(p_value -> 'attachment_ids') > 0);
    when 'note_photo' then
      return coalesce((p_value ->> 'done')::boolean, (p_value ->> 'value')::boolean, false);
    else
      return false;
  end case;
end $$;

create or replace function app.stage_items_complete(p_admission_id uuid, p_stage app.stage, p_ctx jsonb)
returns void
language plpgsql
stable
as $$
declare
  rec record;
  applies boolean;
  entry_val jsonb;
begin
  for rec in
    select *
    from app.checklist_items i
    join app.admissions a on a.id = p_admission_id and i.hospital_id = a.hospital_id
    where i.stage = p_stage and i.active and i.required
  loop
    begin
      applies := app.eval_condition(rec.applies_when, p_ctx);
    exception when others then
      raise exception 'Rule error on %', rec.label;
    end;
    if not applies then
      continue;
    end if;
    select e.value into entry_val
    from app.checklist_entries e
    where e.admission_id = p_admission_id and e.item_key = rec.item_key;
    if not app.item_complete(rec, coalesce(entry_val, '{}'::jsonb), p_ctx) then
      raise exception '% is incomplete', rec.label;
    end if;
  end loop;
end $$;

create or replace function app.registration_complete(p_admission_id uuid)
returns void
language plpgsql
stable
as $$
declare
  a app.admissions%rowtype;
  p app.patients%rowtype;
begin
  select * into a from app.admissions where id = p_admission_id;
  select * into p from app.patients where id = a.patient_id;
  if p.name is null or length(trim(p.name)) = 0 then raise exception 'Name is required'; end if;
  if p.age is null then raise exception 'Age is required'; end if;
  if p.sex is null then raise exception 'Sex is required'; end if;
  if p.father_name is null or length(trim(p.father_name)) = 0 then raise exception 'Father''s name is required'; end if;
  if p.address is null or length(trim(p.address)) = 0 then raise exception 'Address is required'; end if;
  if a.brought_by_name is null or length(trim(a.brought_by_name)) = 0 then raise exception 'Brought-by name is required'; end if;
  if a.brought_by_relation is null or length(trim(a.brought_by_relation)) = 0 then raise exception 'Brought-by relation is required'; end if;
  if a.is_mlc is null then raise exception 'MLC is required'; end if;
  if a.ayushman_status is null then raise exception 'Ayushman status is required'; end if;
  if a.photo_consent is null then raise exception 'Photo consent is required'; end if;
  if coalesce(nullif(p.mobile, ''), nullif(a.brought_by_phone, '')) is null then
    raise exception 'Patient or brought-by phone is required';
  end if;
end $$;

create or replace function app.advance_stage(
  p_admission_id uuid,
  p_to_stage app.stage,
  p_reason text default null,
  p_override boolean default false,
  p_device_id uuid default null,
  p_surgery_date date default null,
  p_completes boolean default false
)
returns app.admissions
language plpgsql
security definer
set search_path = app, public
as $$
declare
  me app.users%rowtype;
  a app.admissions%rowtype;
  tr app.workflow_transitions%rowtype;
  ctx jsonb;
begin
  select * into me from app.users where id = auth.uid();
  if not found or not me.active then
    raise exception 'not allowed';
  end if;
  if not app.can_access(p_admission_id) then
    raise exception 'not allowed';
  end if;
  select * into a from app.admissions where id = p_admission_id for update;
  if a.status <> 'active' then
    raise exception 'admission is not active';
  end if;

  select * into tr
  from app.workflow_transitions
  where hospital_id = a.hospital_id
    and from_stage = a.current_stage
    and to_stage = p_to_stage
    and completes_admission = p_completes;

  if not found then
    raise exception 'That stage move is not allowed';
  end if;

  if p_override then
    if me.role <> 'admin' then
      raise exception 'Only an admin can override a gate';
    end if;
    if p_reason is null or length(trim(p_reason)) = 0 then
      raise exception 'Override needs a reason';
    end if;
  else
    if tr.requires_reason and (p_reason is null or length(trim(p_reason)) = 0) then
      raise exception 'A reason is required';
    end if;
    ctx := app.build_eval_context(p_admission_id);
    if a.current_stage = 'registration' then
      perform app.registration_complete(p_admission_id);
    else
      if a.current_stage = 'ward' and a.wound_type is null then
        raise exception 'Wound type is required';
      end if;
      if p_completes or array_position(
        array['registration','ward','fitness','pre_ot','post_op','discharge']::app.stage[],
        p_to_stage
      ) > array_position(
        array['registration','ward','fitness','pre_ot','post_op','discharge']::app.stage[],
        a.current_stage
      ) then
        perform app.stage_items_complete(p_admission_id, a.current_stage, ctx);
      end if;
    end if;
    if p_to_stage = 'post_op' then
      if coalesce(p_surgery_date, a.surgery_date) is null then
        raise exception 'Surgery date is required to move to OT';
      end if;
    end if;
    begin
      if not app.eval_condition(tr.guard, ctx) then
        raise exception '% is blocked', tr.label;
      end if;
    exception when others then
      if sqlerrm like '%is blocked' then
        raise;
      end if;
      if tr.guard is not null then
        raise exception 'Rule error on this transition';
      end if;
    end;
  end if;

  insert into app.stage_transitions (
    hospital_id, admission_id, from_stage, to_stage, reason, override, by_user, device_id
  ) values (
    a.hospital_id, a.id, a.current_stage, p_to_stage, p_reason, p_override, me.id, coalesce(p_device_id, gen_random_uuid())
  );

  a.current_stage := p_to_stage;
  a.updated_at := now();
  a.updated_by := me.id;
  a.device_id := p_device_id;
  if p_to_stage = 'post_op' then
    a.surgery_date := coalesce(p_surgery_date, a.surgery_date);
  end if;
  if a.current_stage = 'fitness' and tr.from_stage = 'pre_ot' then
    a.fitness_attempt := a.fitness_attempt + 1;
  end if;
  if p_completes then
    a.status := 'discharged';
    a.discharged_at := now();
  end if;
  update app.admissions set
    current_stage = a.current_stage,
    updated_at = a.updated_at,
    updated_by = a.updated_by,
    device_id = a.device_id,
    surgery_date = a.surgery_date,
    fitness_attempt = a.fitness_attempt,
    status = a.status,
    discharged_at = a.discharged_at
  where id = a.id;

  if p_to_stage = 'post_op' then
    insert into app.push_events (hospital_id, admission_id, event_key, title, body, target_user_ids, payload)
    select a.hospital_id, a.id, 'moved_to_ot', 'Patient moved to OT', 'Open Ward Checklist after unlock.',
           coalesce(array_agg(t.user_id), '{}'), jsonb_build_object('admission_id', a.id)
    from app.admission_team t where t.admission_id = a.id;
  elsif tr.from_stage = 'pre_ot' and p_to_stage = 'fitness' then
    insert into app.push_events (hospital_id, admission_id, event_key, title, body, target_user_ids, payload)
    select a.hospital_id, a.id, 'returned_unfit', 'Returned to fitness', 'Open Ward Checklist after unlock.',
           coalesce(array_agg(t.user_id), '{}'), jsonb_build_object('admission_id', a.id)
    from app.admission_team t where t.admission_id = a.id;
  end if;

  return a;
end $$;

create or replace function app.upsert_checklist_entry(
  p_id uuid,
  p_hospital_id uuid,
  p_admission_id uuid,
  p_item_key text,
  p_value jsonb,
  p_done_by uuid,
  p_done_at timestamptz,
  p_updated_at timestamptz,
  p_device_id uuid,
  p_client_mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  existing app.checklist_entries%rowtype;
  incoming_at timestamptz;
  winner boolean;
begin
  if auth.uid() is null or auth.uid() <> p_done_by then
    raise exception 'not allowed';
  end if;
  if not app.can_access(p_admission_id) then
    raise exception 'not allowed';
  end if;

  incoming_at := p_updated_at;
  if incoming_at > now() + interval '2 minutes' then
    incoming_at := now();
  end if;

  select * into existing
  from app.checklist_entries
  where admission_id = p_admission_id and item_key = p_item_key
  for update;

  if not found then
    insert into app.checklist_entries (
      id, hospital_id, admission_id, item_key, value, done_by, done_at, updated_at, device_id, client_mutation_id
    ) values (
      coalesce(p_id, gen_random_uuid()), p_hospital_id, p_admission_id, p_item_key, p_value,
      p_done_by, p_done_at, incoming_at, p_device_id, p_client_mutation_id
    ) returning * into existing;
    return to_jsonb(existing);
  end if;

  if existing.client_mutation_id = p_client_mutation_id then
    return to_jsonb(existing);
  end if;

  winner := incoming_at > existing.updated_at
    or (incoming_at = existing.updated_at and p_device_id::text > existing.device_id::text);

  if not winner then
    insert into app.audit_log (hospital_id, who, action, table_name, row_id, old_row, new_row)
    values (
      p_hospital_id,
      auth.uid(),
      'conflict_discarded',
      'checklist_entries',
      existing.id,
      to_jsonb(existing),
      jsonb_build_object(
        'id', p_id,
        'value', p_value,
        'done_by', p_done_by,
        'updated_at', incoming_at,
        'device_id', p_device_id,
        'client_mutation_id', p_client_mutation_id
      )
    );
    insert into app.push_events (hospital_id, admission_id, event_key, title, body, target_user_ids, payload)
    values (
      p_hospital_id, p_admission_id, 'conflict_discarded',
      'Kept a later entry', 'Open Ward Checklist after unlock.',
      array[p_done_by],
      jsonb_build_object('admission_id', p_admission_id, 'item_key', p_item_key)
    );
    return to_jsonb(existing) || jsonb_build_object('discarded', true);
  end if;

  update app.checklist_entries set
    value = p_value,
    done_by = p_done_by,
    done_at = p_done_at,
    updated_at = incoming_at,
    device_id = p_device_id,
    client_mutation_id = p_client_mutation_id
  where id = existing.id
  returning * into existing;
  return to_jsonb(existing);
end $$;

create or replace function app.cancel_admission(p_admission_id uuid, p_reason text)
returns app.admissions
language plpgsql
security definer
set search_path = app, public
as $$
declare
  me app.users%rowtype;
  a app.admissions%rowtype;
begin
  select * into me from app.users where id = auth.uid() and active;
  if me.role <> 'admin' then
    raise exception 'Only an admin can cancel an admission';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required';
  end if;
  update app.admissions
  set status = 'cancelled', cancel_reason = p_reason, updated_at = now(), updated_by = me.id
  where id = p_admission_id
  returning * into a;
  return a;
end $$;

create or replace function app.revoke_device(p_device_id uuid)
returns app.user_devices
language plpgsql
security definer
set search_path = app, public
as $$
declare
  me app.users%rowtype;
  d app.user_devices%rowtype;
begin
  select * into me from app.users where id = auth.uid() and active;
  if me.role <> 'admin' then
    raise exception 'Only an admin can revoke a device';
  end if;
  update app.user_devices
  set revoked_at = now()
  where id = p_device_id and hospital_id = me.hospital_id
  returning * into d;
  return d;
end $$;
