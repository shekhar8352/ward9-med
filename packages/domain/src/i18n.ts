export const en = {
  appName: 'Ward Checklist',
  updateRequired: 'Update Ward Checklist',
  updateRequiredBody: 'This phone is on an older version. Update before ticking items.',
  savedOnPhone: 'Saved on this phone',
  synced: 'Synced',
  pendingPhotos: 'A photo is still on this phone. Uninstalling the app loses those files.',
  pendingPhotosMlc: 'MLC photos are still on this phone. Keep the app installed until they upload.',
  consentRequired: 'Photo consent is required before the camera opens.',
  duplicateHint: 'A patient with this name or mobile is already on the list.',
  gateBlocked: 'Cannot advance yet',
  needsAttention: 'Needs attention',
  patients: 'Patients',
  admin: 'Admin',
  unlock: 'Unlock',
  setPin: 'Set a 4-digit PIN',
  phone: 'Mobile number',
  sendOtp: 'Send code',
  otp: 'SMS code',
  grievance: 'Grievance contact',
  paperRecord: 'The paper case sheet is the official medical record during the pilot.',
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey): string {
  return en[key];
}
