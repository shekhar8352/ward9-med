import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { STAGE_LABELS } from '@ward9/domain';
import { useDb, usePatientList } from '../../../src/data/hooks';
import { getCurrentUser } from '../../../src/data/memoryStore';
import { SyncBanner } from '../../../src/components/SyncBanner';
import { Badge, Button, Card, Field, Screen, Title } from '../../../src/components/ui';
import { colors } from '../../../src/theme';

export default function PatientsScreen() {
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const rows = usePatientList(q);
  const db = useDb();
  const me = getCurrentUser();
  const filtered = mine
    ? rows.filter((r) => db.team.some((t) => t.admission_id === r.admission.id && t.user_id === me?.id))
    : rows;

  return (
    <Screen>
      <SyncBanner />
      <Title>Active admissions</Title>
      <Field placeholder="Search name or mobile" value={q} onChangeText={setQ} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label={mine ? 'My patients on' : 'My patients'} onPress={() => setMine(!mine)} tone="ghost" />
        <Button label="Register" onPress={() => router.push('/(app)/patients/new')} />
      </View>
      {filtered.map(({ admission, patient, flags }) => (
        <Pressable key={admission.id} onPress={() => router.push(`/(app)/patients/${admission.id}`)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>{patient.name}</Text>
              {flags.length > 0 ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
            </View>
            <Text style={{ color: colors.muted }}>
              {patient.age} / {patient.sex} · {STAGE_LABELS[admission.current_stage]}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {admission.is_mlc ? <Badge label="MLC" tone="mlc" /> : null}
              {admission.ayushman_status === 'applied' ? <Badge label="Ayushman" tone="teal" /> : null}
              {admission.ayushman_status === 'not_applied' ? <Badge label="Ayushman not applied" tone="warn" /> : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
