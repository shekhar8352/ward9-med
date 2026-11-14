import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { enableBiometrics, setPin } from '../../src/security/pin';
import { useSession } from '../../src/state/session';
import { Body, Button, Field, Label, Screen, Title } from '../../src/components/ui';

export default function SetPinScreen() {
  const [pin, setPinValue] = useState('');
  const [again, setAgain] = useState('');
  const session = useSession();

  async function save() {
    if (pin !== again) {
      Alert.alert('PIN mismatch', 'Enter the same 4 digits twice.');
      return;
    }
    await setPin(pin);
    try {
      await enableBiometrics(true);
    } catch {
      /* optional */
    }
    session.unlock();
    router.replace('/(app)/patients');
  }

  return (
    <Screen>
      <Title>Set a 4-digit PIN</Title>
      <Body>This locks the app after 15 minutes in the background. Five failed attempts require a new SMS code.</Body>
      <Label>PIN</Label>
      <Field keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={setPinValue} />
      <Label>Again</Label>
      <Field keyboardType="number-pad" secureTextEntry maxLength={4} value={again} onChangeText={setAgain} />
      <Button label="Save PIN" onPress={save} disabled={pin.length !== 4} />
    </Screen>
  );
}
