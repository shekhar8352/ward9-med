create or replace function app.resolve_path(ctx jsonb, path text)
returns jsonb
language plpgsql
immutable
as $$
declare
  root text;
  rest text;
  current jsonb;
  part text;
begin
  if path is null or path = '' then
    raise exception 'unknown path: %', path;
  end if;
  if position('.' in path) = 0 then
    if not ctx ? path then
      raise exception 'unknown path: %', path;
    end if;
    return ctx -> path;
  end if;
  root := split_part(path, '.', 1);
  rest := substr(path, length(root) + 2);
  if not ctx ? root then
    raise exception 'unknown path: %', path;
  end if;
  current := ctx -> root;
  if root = 'entries' then
    if current is null or not current ? rest then
      raise exception 'unknown path: %', path;
    end if;
    return current -> rest;
  end if;
  foreach part in array string_to_array(rest, '.')
  loop
    if current is null or jsonb_typeof(current) <> 'object' or not current ? part then
      raise exception 'unknown path: %', path;
    end if;
    current := current -> part;
  end loop;
  return current;
end $$;

create or replace function app.json_equal(a jsonb, b jsonb)
returns boolean
language plpgsql
immutable
as $$
begin
  if a is null and b is null then
    return true;
  end if;
  if a is null or b is null then
    return false;
  end if;
  if jsonb_typeof(a) in ('number', 'string') and jsonb_typeof(b) in ('number', 'string') then
    begin
      if (a #>> '{}')::numeric = (b #>> '{}')::numeric then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;
  return a = b;
end $$;

create or replace function app.eval_condition(cond jsonb, ctx jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  op text;
  resolved jsonb;
  child jsonb;
  all_true boolean;
  any_true boolean;
  left_n numeric;
  right_n numeric;
  arr_elem jsonb;
begin
  if cond is null or cond = 'null'::jsonb then
    return true;
  end if;
  op := cond ->> 'op';
  if op is null then
    raise exception 'unknown operator: missing';
  end if;
  case op
    when 'and' then
      all_true := true;
      if cond -> 'args' is null then
        raise exception 'and requires args';
      end if;
      for child in select jsonb_array_elements(cond -> 'args')
      loop
        if not app.eval_condition(child, ctx) then
          all_true := false;
        end if;
      end loop;
      return all_true;
    when 'or' then
      any_true := false;
      if cond -> 'args' is null then
        raise exception 'or requires args';
      end if;
      for child in select jsonb_array_elements(cond -> 'args')
      loop
        if app.eval_condition(child, ctx) then
          any_true := true;
        end if;
      end loop;
      return any_true;
    when 'not' then
      if cond -> 'arg' is null then
        raise exception 'not requires arg';
      end if;
      return not app.eval_condition(cond -> 'arg', ctx);
    when 'exists' then
      resolved := app.resolve_path(ctx, cond ->> 'path');
      return resolved is not null and resolved <> 'null'::jsonb;
    when 'eq' then
      return app.json_equal(app.resolve_path(ctx, cond ->> 'path'), cond -> 'value');
    when 'neq' then
      return not app.json_equal(app.resolve_path(ctx, cond ->> 'path'), cond -> 'value');
    when 'gt', 'gte', 'lt', 'lte' then
      begin
        left_n := (app.resolve_path(ctx, cond ->> 'path') #>> '{}')::numeric;
        right_n := (cond -> 'value' #>> '{}')::numeric;
      exception when others then
        raise exception 'cannot compare % % %', cond ->> 'path', op, cond -> 'value';
      end;
      case op
        when 'gt' then return left_n > right_n;
        when 'gte' then return left_n >= right_n;
        when 'lt' then return left_n < right_n;
        else return left_n <= right_n;
      end case;
    when 'contains' then
      resolved := app.resolve_path(ctx, cond ->> 'path');
      if jsonb_typeof(resolved) = 'array' then
        for arr_elem in select jsonb_array_elements(resolved)
        loop
          if app.json_equal(arr_elem, cond -> 'value') then
            return true;
          end if;
        end loop;
        return false;
      end if;
      if jsonb_typeof(resolved) = 'string' then
        return position((cond ->> 'value') in (resolved #>> '{}')) > 0;
      end if;
      return false;
    when 'in' then
      resolved := app.resolve_path(ctx, cond ->> 'path');
      if jsonb_typeof(cond -> 'value') <> 'array' then
        raise exception 'in requires array value';
      end if;
      for arr_elem in select jsonb_array_elements(cond -> 'value')
      loop
        if app.json_equal(arr_elem, resolved) then
          return true;
        end if;
      end loop;
      return false;
    else
      raise exception 'unknown operator: %', op;
  end case;
end $$;

create or replace function app.forbid_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'hard delete is disabled on %', tg_table_name;
end $$;

create or replace function app.forbid_audit_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end $$;

create trigger patients_no_delete before delete on app.patients
  for each row execute function app.forbid_delete();
create trigger admissions_no_delete before delete on app.admissions
  for each row execute function app.forbid_delete();
create trigger admission_team_no_delete before delete on app.admission_team
  for each row execute function app.forbid_delete();
create trigger checklist_entries_no_delete before delete on app.checklist_entries
  for each row execute function app.forbid_delete();
create trigger attachments_no_delete before delete on app.attachments
  for each row execute function app.forbid_delete();
create trigger stage_transitions_no_delete before delete on app.stage_transitions
  for each row execute function app.forbid_delete();

create trigger audit_no_change before update or delete on app.audit_log
  for each row execute function app.forbid_audit_change();

create or replace function app.write_audit()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  hid uuid;
  rid uuid;
begin
  hid := coalesce(new.hospital_id, old.hospital_id);
  begin
    rid := coalesce(new.id, old.id);
  exception when others then
    rid := coalesce(new.admission_id, old.admission_id);
  end;
  insert into app.audit_log (hospital_id, who, action, table_name, row_id, old_row, new_row)
  values (
    hid,
    auth.uid(),
    tg_op,
    tg_table_name,
    rid,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger patients_audit after insert or update on app.patients
  for each row execute function app.write_audit();
create trigger admissions_audit after insert or update on app.admissions
  for each row execute function app.write_audit();
create trigger entries_audit after insert or update on app.checklist_entries
  for each row execute function app.write_audit();
create trigger attachments_audit after insert or update on app.attachments
  for each row execute function app.write_audit();
create trigger stage_transitions_audit after insert or update on app.stage_transitions
  for each row execute function app.write_audit();
create trigger team_audit after insert or update on app.admission_team
  for each row execute function app.write_audit();
