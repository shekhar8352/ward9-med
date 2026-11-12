-- PowerSync replicates from this publication. audit_log stays off phones.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    create publication powersync;
  end if;
end $$;

alter publication powersync add table
  app.hospitals,
  app.users,
  app.user_devices,
  app.patients,
  app.admissions,
  app.admission_team,
  app.checklist_items,
  app.workflow_transitions,
  app.checklist_entries,
  app.attachments,
  app.stage_transitions;
