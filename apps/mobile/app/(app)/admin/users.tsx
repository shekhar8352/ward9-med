import { useState } from 'react';
import { Text } from 'react-native';
import { getState, inviteUser, setUserActive } from '../../../src/data/memoryStore';
import { useDb } from '../../../src/data/hooks';
import { Button, Card, Chip, Field, Label, Screen, Title } from '../../../src/components/ui';
import type { UserRole } from '@ward9/domain';

export default function UsersScreen() {
  useDb();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [role, setRole] = useState<UserRole>('resident');

  return (
    <Screen>
      <Title>Doctors</Title>
      <Label>Name</Label>
      <Field value={name} onChangeText={setName} />
      <Label>Phone</Label>
      <Field value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Chip label="Resident" selected={role === 'resident'} onPress={() => setRole('resident')} />
      <Chip label="Consultant" selected={role === 'consultant'} onPress={() => setRole('consultant')} />
      <Chip label="Admin" selected={role === 'admin'} onPress={() => setRole('admin')} />
      <Button
        label="Invite"
        onPress={() => {
          inviteUser(name, phone, role);
          setName('');
        }}
      />
      {getState().users.map((u) => (
        <Card key={u.id}>
          <Text>
            {u.name} · {u.role} · {u.phone}
          </Text>
          <Button
            label={u.active ? 'Deactivate' : 'Activate'}
            tone={u.active ? 'danger' : 'primary'}
            onPress={() => setUserActive(u.id, !u.active)}
          />
        </Card>
      ))}
    </Screen>
  );
}
