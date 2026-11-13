import { useEffect } from 'react';
import { Image, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAdmissionBundle } from '../../../../src/data/hooks';
import { protectScreen } from '../../../../src/security/screenshot';
import { Body, Card, Screen, Title } from '../../../../src/components/ui';
import { getState } from '../../../../src/data/memoryStore';

export default function PhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { attachments, admission } = useAdmissionBundle(id);

  useEffect(() => {
    void protectScreen(true);
    return () => {
      void protectScreen(false);
    };
  }, []);

  return (
    <Screen>
      <Title>Photos</Title>
      <Body>There is no share to WhatsApp. Screenshots are blocked on this screen.</Body>
      {attachments.map((a) => (
        <Card key={a.id}>
          <Text>{a.kind}</Text>
          <Body>
            {a.upload_status === 'uploaded'
              ? 'Uploaded'
              : `Still on ${getState().users.find((u) => u.id === a.uploaded_by)?.name ?? 'a phone'}`}
          </Body>
          {a.local_uri ? (
            <Image source={{ uri: a.local_uri }} style={{ width: '100%', height: 220, borderRadius: 8 }} />
          ) : (
            <Body>Photo still on Dr {a.uploaded_by}'s phone</Body>
          )}
        </Card>
      ))}
      {attachments.length === 0 ? <Body>No photos yet.{admission?.photo_consent ? '' : ' Photo consent is off.'}</Body> : null}
    </Screen>
  );
}
