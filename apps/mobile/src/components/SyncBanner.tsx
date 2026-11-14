import { Text, View } from 'react-native';
import { t } from '@ward9/domain';
import { useDb } from '../data/hooks';
import { pendingPhotoCount } from '../data/photoQueue';
import { colors, space } from '../theme';

export function SyncBanner({ isMlc }: { isMlc?: boolean }) {
  const db = useDb();
  const pending = pendingPhotoCount();
  const label = db.syncStatus === 'synced' ? t('synced') : t('savedOnPhone');
  return (
    <View style={{ backgroundColor: colors.banner, padding: space.sm, gap: 4 }}>
      <Text style={{ color: colors.teal, fontWeight: '600' }}>{label}</Text>
      {pending > 0 ? (
        <Text style={{ color: isMlc ? colors.danger : colors.accent }}>
          {isMlc ? t('pendingPhotosMlc') : t('pendingPhotos')} ({pending})
        </Text>
      ) : null}
      {db.lastConflict ? (
        <Text style={{ color: colors.accent }}>Kept a later entry for {db.lastConflict.item_key}.</Text>
      ) : null}
    </View>
  );
}
