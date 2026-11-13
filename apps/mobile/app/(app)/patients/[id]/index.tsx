import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { canAdvance, STAGE_LABELS, STAGES, type Stage } from '@ward9/domain';
import { useAdmissionBundle } from '../../../../src/data/hooks';
import { advanceStage, getCurrentUser, getState } from '../../../../src/data/memoryStore';
import { rescheduleReminders } from '../../../../src/notifications/localReminders';
import { StageHeader } from '../../../../src/components/StageHeader';
import { SyncBanner } from '../../../../src/components/SyncBanner';
import { Badge, Body, Button, Card, Field, Screen, Title } from '../../../../src/components/ui';
import { colors } from '../../../../src/theme';
import { requestDischargePdf } from '../../../../src/data/dischargePdf';

export default function AdmissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { admission, patient, entries, items, transitions, team, attachments } = useAdmissionBundle(id);
  const [reason, setReason] = useState('');
  const [surgery, setSurgery] = useState(admission?.surgery_date ?? '');
  const me = getCurrentUser();
  if (!admission || !patient) return <Screen><Body>Not on this phone.</Body></Screen>;

  const last = [...entries].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const lastName = getState().users.find((u) => u.id === last?.done_by)?.name ?? last?.done_by;

  function tryAdvance(to: Stage, completes = false) {
    const gate = canAdvance({
      fromStage: admission.current_stage,
      toStage: to,
      patient,
      admission: { ...admission, surgery_date: surgery || admission.surgery_date },
      items,
      entries,
      transitions,
      reason,
      role: me?.role,
      completesAdmission: completes,
    });
    if (!gate.can) {
      Alert.alert('Cannot advance yet', gate.reason);
      return;
    }
    try {
      advanceStage({
        admissionId: admission.id,
        toStage: to,
        reason,
        surgeryDate: surgery || undefined,
        completesAdmission: completes,
      });
      void rescheduleReminders();
    } catch (e) {
      Alert.alert('Blocked', e instanceof Error ? e.message : String(e));
    }
  }

  const idx = STAGES.indexOf(admission.current_stage);
  const next = STAGES[idx + 1];
  const loopBack = admission.current_stage === 'pre_ot';
  const completeDischarge = admission.current_stage === 'discharge' && admission.status === 'active';

  return (
    <Screen>
      <SyncBanner isMlc={Boolean(admission.is_mlc)} />
      <Title>{patient.name}</Title>
      <Body>
        {patient.age} / {patient.sex} · {patient.father_name}
      </Body>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {admission.is_mlc ? <Badge label="MLC" tone="mlc" /> : null}
        {admission.ayushman_status ? <Badge label={`Ayushman ${admission.ayushman_status}`} tone="teal" /> : null}
        {admission.status !== 'active' ? <Badge label={admission.status} tone="warn" /> : null}
      </View>
      <StageHeader
        current={admission.current_stage}
        onPress={(s) => router.push(`/(app)/patients/${id}/stage/${s}`)}
      />
      <Card>
        <Text style={{ fontWeight: '700' }}>{STAGE_LABELS[admission.current_stage]}</Text>
        {last ? <Body>Last change: {last.item_key} by {lastName}</Body> : <Body>No ticks yet.</Body>}
        <Body>Team: {team.map((t) => getState().users.find((u) => u.id === t.user_id)?.name).join(', ') || '—'}</Body>
        <Body>Fitness attempt {admission.fitness_attempt}</Body>
      </Card>
      {admission.current_stage === 'pre_ot' ? (
        <>
          <Field placeholder="Surgery date YYYY-MM-DD" value={surgery} onChangeText={setSurgery} />
        </>
      ) : null}
      {(loopBack || transitions.some((t) => t.requires_reason && t.from_stage === admission.current_stage)) && (
        <Field placeholder="Reason" value={reason} onChangeText={setReason} />
      )}
      <Button
        label={`Open ${STAGE_LABELS[admission.current_stage]}`}
        onPress={() => router.push(`/(app)/patients/${id}/stage/${admission.current_stage}`)}
      />
      {next && admission.current_stage !== 'discharge' ? (
        <Button
          label={next === 'post_op' ? 'Move to OT / post-op' : `Move to ${STAGE_LABELS[next]}`}
          onPress={() => tryAdvance(next)}
        />
      ) : null}
      {loopBack ? <Button label="Return to fitness" onPress={() => tryAdvance('fitness')} tone="ghost" /> : null}
      {completeDischarge ? (
        <Button label="Complete discharge" onPress={() => tryAdvance('discharge', true)} />
      ) : null}
      {me?.role === 'admin' ? (
        <Button
          label="Admin override to next stage"
          tone="danger"
          onPress={() => {
            if (!reason.trim()) {
              Alert.alert('Reason required', 'Override needs a reason');
              return;
            }
            if (!next) return;
            advanceStage({
              admissionId: admission.id,
              toStage: next,
              reason,
              override: true,
              surgeryDate: surgery || undefined,
            });
          }}
        />
      ) : null}
      {admission.current_stage === 'discharge' ? (
        <Button
          label="Discharge checklist PDF"
          tone="ghost"
          onPress={() => {
            requestDischargePdf(admission.id)
              .then((r) => {
                if (r.signedUrl) return Linking.openURL(r.signedUrl);
                Alert.alert('PDF', 'Connect Supabase to generate the checklist PDF. The on-screen checklist is complete without it.');
              })
              .catch((e) => Alert.alert('PDF', e instanceof Error ? e.message : String(e)));
          }}
        />
      ) : null}
      <Button label="Photos" tone="ghost" onPress={() => router.push(`/(app)/patients/${id}/photos`)} />
      <Button label="Team" tone="ghost" onPress={() => router.push(`/(app)/patients/${id}/team`)} />
      <Body>{attachments.filter((a) => a.upload_status !== 'uploaded').length} photo(s) still on a phone.</Body>
    </Screen>
  );
}
