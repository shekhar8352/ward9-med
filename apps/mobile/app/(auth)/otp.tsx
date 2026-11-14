import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase, supabaseConfigured } from '../../src/data/supabase';
import { demoUserForPhone, useSession } from '../../src/state/session';
import { hasPin } from '../../src/security/pin';
import { Body, Button, Field, Label, Screen, Title } from '../../src/components/ui';

export default function OtpScreen() {
  const [code, setCode] = useState('');
  const session = useSession();

  async function verify() {
    const phone = session.phone ?? '';
    if (supabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error || !data.user) {
        Alert.alert('Code not accepted', error?.message ?? 'Try again');
        return;
      }
      await session.completeLogin(data.user.id);
    } else {
      if (code !== '123456') {
        Alert.alert('Code not accepted', 'Demo code is 123456');
        return;
      }
      const id = demoUserForPhone(phone);
      if (!id) {
        Alert.alert('Invite only', 'This number is not on the ward list.');
        return;
      }
      await session.completeLogin(id);
    }
    router.replace((await hasPin()) ? '/(auth)/unlock' : '/(auth)/set-pin');
  }

  return (
    <Screen>
      <Title>Enter the SMS code</Title>
      <Body>The code expires quickly. Request a new one if it does not arrive.</Body>
      <Label>Code</Label>
      <Field keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} />
      <Button label="Continue" onPress={verify} disabled={code.length < 4} />
    </Screen>
  );
}
