-- One hospital. Replace the name before go-live.
insert into app.hospitals (id, name, grievance_contact)
values (
  '00000000-0000-4000-8000-000000000001',
  'Ward 9 Orthopaedic',
  'Hospital administration'
)
on conflict (id) do nothing;

insert into app.checklist_items (
  hospital_id, stage, item_key, label, help_text, field_type, required, applies_when, options, sort_order
)
values
  ('00000000-0000-4000-8000-000000000001', 'ward', 'dressing.daily', 'Daily dressing done', null, 'bool', true,
    '{"op":"eq","path":"admission.wound_type","value":"compound"}'::jsonb, null, 10),
  ('00000000-0000-4000-8000-000000000001', 'ward', 'wound.note', 'Wound information', null, 'text', true,
    '{"op":"eq","path":"admission.wound_type","value":"non_compound"}'::jsonb, null, 20),
  ('00000000-0000-4000-8000-000000000001', 'ward', 'wound.photos', 'Wound photos', 'Optional. Needs photo consent.', 'photo', false,
    '{"op":"eq","path":"admission.wound_type","value":"non_compound"}'::jsonb, null, 30),
  ('00000000-0000-4000-8000-000000000001', 'ward', 'blood.report', 'Blood investigations', 'Mark fine or not fine after review.', 'note_photo', true, null, null, 40),
  ('00000000-0000-4000-8000-000000000001', 'ward', 'procedure.plan', 'Planned procedure', null, 'multi_enum', true, null,
    '{"choices":["bipolar","THR","TCR","other","undecided"]}'::jsonb, 50),
  ('00000000-0000-4000-8000-000000000001', 'fitness', 'fitness.pedio', 'Pediatric (Pedio) clearance', 'Age under 18.', 'enum', true,
    '{"op":"lt","path":"patient.age","value":18}'::jsonb, '{"choices":["fit","unfit","pending"]}'::jsonb, 10),
  ('00000000-0000-4000-8000-000000000001', 'fitness', 'fitness.cardiopul', 'Cardiopulmonary assessment', 'Age 18 and above.', 'enum', true,
    '{"op":"gte","path":"patient.age","value":18}'::jsonb, '{"choices":["fit","unfit","pending"]}'::jsonb, 20),
  ('00000000-0000-4000-8000-000000000001', 'fitness', 'fitness.tbcd', 'TBCD clearance', 'Expand this label with the doctors before the live pilot.', 'enum', true,
    '{"op":"gt","path":"patient.age","value":30}'::jsonb, '{"choices":["fit","unfit","pending"]}'::jsonb, 30),
  ('00000000-0000-4000-8000-000000000001', 'fitness', 'fitness.cardio', 'Cardiology referral', 'Age over 55.', 'enum', true,
    '{"op":"gt","path":"patient.age","value":55}'::jsonb, '{"choices":["fit","unfit","pending"]}'::jsonb, 40),
  ('00000000-0000-4000-8000-000000000001', 'fitness', 'fitness.echo', '2D echo', 'Age over 60, or bipolar / THR / TCR.', 'enum', true,
    '{"op":"or","args":[{"op":"gt","path":"patient.age","value":60},{"op":"contains","path":"admission.planned_procedures","value":"THR"},{"op":"contains","path":"admission.planned_procedures","value":"bipolar"},{"op":"contains","path":"admission.planned_procedures","value":"TCR"}]}'::jsonb,
    '{"choices":["fit","unfit","pending"]}'::jsonb, 50),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'ayushman.indent', 'Indent', null, 'note_photo', true,
    '{"op":"eq","path":"admission.ayushman_status","value":"applied"}'::jsonb, null, 10),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'ayushman.os', 'OS', null, 'note_photo', true,
    '{"op":"eq","path":"admission.ayushman_status","value":"applied"}'::jsonb, null, 20),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'ayushman.cms', 'CMS', null, 'note_photo', true,
    '{"op":"eq","path":"admission.ayushman_status","value":"applied"}'::jsonb, null, 30),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'ayushman.shop', 'Shop', null, 'note_photo', true,
    '{"op":"eq","path":"admission.ayushman_status","value":"applied"}'::jsonb, null, 40),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'billing.bill', 'Bill', null, 'note_photo', true,
    '{"op":"in","path":"admission.ayushman_status","value":["none","not_applied"]}'::jsonb, null, 10),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'billing.supplies', 'Surgical supplies', null, 'note_photo', true,
    '{"op":"in","path":"admission.ayushman_status","value":["none","not_applied"]}'::jsonb, null, 20),
  ('00000000-0000-4000-8000-000000000001', 'post_op', 'postop.xray', 'Post-op X-ray', null, 'photo', true, null, null, 10),
  ('00000000-0000-4000-8000-000000000001', 'post_op', 'dressing.day2', 'Day 2 dressing', 'Required once that day has arrived. Waiver needs a reason.', 'bool', true, null, null, 20),
  ('00000000-0000-4000-8000-000000000001', 'post_op', 'dressing.day4', 'Day 4 dressing', 'Required once that day has arrived. Waiver needs a reason.', 'bool', true, null, null, 30),
  ('00000000-0000-4000-8000-000000000001', 'post_op', 'ayushman.close', 'Close Ayushman process', null, 'note_photo', true,
    '{"op":"eq","path":"admission.ayushman_status","value":"applied"}'::jsonb, null, 40),
  ('00000000-0000-4000-8000-000000000001', 'discharge', 'discharge.photocopy', 'Photocopy of discharge copy', 'MLC only.', 'photo', true,
    '{"op":"eq","path":"admission.is_mlc","value":true}'::jsonb, null, 10),
  ('00000000-0000-4000-8000-000000000001', 'discharge', 'discharge.xray_copy', 'X-ray copy provided', null, 'bool', true, null, null, 20)
on conflict (hospital_id, item_key) do nothing;

insert into app.workflow_transitions (
  hospital_id, from_stage, to_stage, guard, requires_reason, label, completes_admission
) values
  ('00000000-0000-4000-8000-000000000001', 'registration', 'ward', null, false, 'Admit to ward', false),
  ('00000000-0000-4000-8000-000000000001', 'ward', 'fitness', null, false, 'Move to fitness', false),
  ('00000000-0000-4000-8000-000000000001', 'fitness', 'pre_ot',
    '{"op":"not","arg":{"op":"eq","path":"entries.__fitness_any__","value":"pending"}}'::jsonb,
    false, 'Move to pre-OT', false),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'fitness',
    '{"op":"eq","path":"entries.__fitness_any__","value":"unfit"}'::jsonb,
    true, 'Return to fitness', false),
  ('00000000-0000-4000-8000-000000000001', 'pre_ot', 'post_op',
    '{"op":"and","args":[{"op":"eq","path":"entries.blood.cleared","value":"fine"},{"op":"not","arg":{"op":"eq","path":"entries.__fitness_any__","value":"unfit"}},{"op":"not","arg":{"op":"eq","path":"entries.__fitness_any__","value":"pending"}}]}'::jsonb,
    false, 'Move to OT / post-op', false),
  ('00000000-0000-4000-8000-000000000001', 'post_op', 'discharge', null, false, 'Move to discharge', false),
  ('00000000-0000-4000-8000-000000000001', 'discharge', 'discharge', null, false, 'Complete discharge', true)
on conflict do nothing;
