import { Text } from 'react-native';
import { useDb } from '../../../src/data/hooks';
import { supabase, supabaseConfigured } from '../../../src/data/supabase';
import { Body, Card, Screen, Title } from '../../../src/components/ui';
import { useEffect, useState } from 'react';

type Row = { id: string; action: string; table_name: string; at: string; who: string | null };

export default function AuditScreen() {
  const db = useDb();
  const [remote, setRemote] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    void supabase
      .from('audit_log')
      .select('id, action, table_name, at, who')
      .order('at', { ascending: false })
      .limit(100)
      .then(({ data }) => setRemote((data as Row[]) ?? []));
  }, []);

  const rows = remote ?? db.audit.slice().reverse();

  return (
    <Screen>
      <Title>Audit log</Title>
      <Body>
        {remote ? 'Live from the hospital database (online).' : 'On this phone only until Postgres is connected. Admins see the full log online.'}
      </Body>
      {rows.map((r) => (
        <Card key={r.id}>
          <Text>
            {r.action} · {r.table_name}
          </Text>
          <Body>
            {r.at} · {r.who ?? 'system'}
          </Body>
        </Card>
      ))}
    </Screen>
  );
}
