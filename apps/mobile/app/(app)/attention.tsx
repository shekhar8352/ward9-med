import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { usePatientList } from '../../src/data/hooks';
import { Card, Screen, Title, Body } from '../../src/components/ui';
import { colors } from '../../src/theme';

export default function AttentionScreen() {
  const rows = usePatientList('').filter((r) => r.flags.length > 0);
  return (
    <Screen>
      <Title>Needs attention</Title>
      {rows.length === 0 ? <Body>Nothing waiting.</Body> : null}
      {rows.map(({ admission, patient, flags }) => (
        <Pressable key={admission.id} onPress={() => router.push(`/(app)/patients/${admission.id}`)}>
          <Card>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{patient.name}</Text>
            {flags.map((f) => (
              <Body key={f.kind + (f.item_key ?? '')}>{f.label}</Body>
            ))}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
