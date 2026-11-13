import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAdmissionBundle } from '../../../../src/data/hooks';
import { getState, setTeam } from '../../../../src/data/memoryStore';
import { Body, Chip, Screen, Title } from '../../../../src/components/ui';

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { team } = useAdmissionBundle(id);
  const users = getState().users.filter((u) => u.active);
  const selected = new Set(team.map((t) => t.user_id));

  function toggle(userId: string) {
    const next = selected.has(userId)
      ? [...selected].filter((x) => x !== userId)
      : [...selected, userId];
    try {
      setTeam(id, next);
    } catch (e) {
      Alert.alert('Team', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen>
      <Title>Admission team</Title>
      <Body>Used for “my patients” and for push messages. Every doctor on the ward can still see active patients.</Body>
      {users.map((u) => (
        <Chip key={u.id} label={`${u.name} (${u.role})`} selected={selected.has(u.id)} onPress={() => toggle(u.id)} />
      ))}
    </Screen>
  );
}
