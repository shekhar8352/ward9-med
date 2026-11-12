import { Redirect } from 'expo-router';
import { useSession } from '../src/state/session';

export default function Index() {
  const { userId, locked } = useSession();
  if (!userId || locked) return <Redirect href="/(auth)/phone" />;
  return <Redirect href="/(app)/patients" />;
}
