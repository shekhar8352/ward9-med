create or replace function public.otp_phone_allowed(p_phone text)
returns boolean
language sql
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.users u
    where u.active
      and regexp_replace(u.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
  ) or exists (
    select 1 from app.invites i
    where i.accepted_at is null
      and regexp_replace(i.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
  );
$$;

grant execute on function public.otp_phone_allowed(text) to service_role;
