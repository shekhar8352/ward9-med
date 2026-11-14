import { getState } from '../data/memoryStore';

function addDays(iso: string, days: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + days, 8, 0, 0);
}

export async function rescheduleReminders(): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const db = getState();
    for (const admission of db.admissions) {
      if (admission.status !== 'active' || !admission.surgery_date) continue;
      const entries = db.entries.filter((e) => e.admission_id === admission.id);
      const day2done = entries.some((e) => e.item_key === 'dressing.day2' && (e.value as { done?: boolean }).done);
      const day4done = entries.some((e) => e.item_key === 'dressing.day4' && (e.value as { done?: boolean }).done);
      const xray = entries.some((e) => e.item_key === 'postop.xray');
      if (!day2done) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Dressing due', body: 'Open Ward Checklist after unlock.', data: { screen: 'attention' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: addDays(admission.surgery_date, 2) },
        });
      }
      if (!day4done) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Dressing due', body: 'Open Ward Checklist after unlock.', data: { screen: 'attention' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: addDays(admission.surgery_date, 4) },
        });
      }
      if (!xray) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Post-op X-ray', body: 'Open Ward Checklist after unlock.', data: { screen: 'attention' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: addDays(admission.surgery_date, 1) },
        });
      }
    }
  } catch {
    /* notifications unavailable in this runtime */
  }
}
