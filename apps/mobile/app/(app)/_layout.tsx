import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSession } from '../../src/state/session';
import { getCurrentUser } from '../../src/data/memoryStore';
import { colors } from '../../src/theme';

export default function AppLayout() {
  const { userId, locked } = useSession();
  if (!userId || locked) return <Redirect href="/(auth)/phone" />;
  const admin = getCurrentUser()?.role === 'admin';
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.teal },
        headerTintColor: '#fff',
        tabBarActiveTintColor: colors.teal,
      }}
    >
      <Tabs.Screen
        name="patients"
        options={{ title: 'Patients', headerShown: false, tabBarIcon: () => <Text>P</Text> }}
      />
      <Tabs.Screen
        name="attention"
        options={{ title: 'Needs attention', tabBarIcon: () => <Text>!</Text> }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          headerShown: false,
          href: admin ? undefined : null,
          tabBarIcon: () => <Text>A</Text>,
        }}
      />
    </Tabs>
  );
}
