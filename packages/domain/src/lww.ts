export type LwwRow = {
  value: unknown;
  updatedAt: number;
  deviceId: string;
  clientMutationId: string;
  doneBy: string;
};

export type LwwResult = {
  applied: LwwRow;
  discarded: LwwRow | null;
  clamped: boolean;
};

const TWO_MINUTES_MS = 2 * 60 * 1000;

export function clampUpdatedAt(updatedAt: number, now: number): { at: number; clamped: boolean } {
  if (updatedAt > now + TWO_MINUTES_MS) {
    return { at: now, clamped: true };
  }
  return { at: updatedAt, clamped: false };
}

/** Smaller device_id loses on a timestamp tie. Same mutation id is idempotent. */
export function lastWriteWins(existing: LwwRow | null, incoming: LwwRow, now: number): LwwResult {
  const { at, clamped } = clampUpdatedAt(incoming.updatedAt, now);
  const incomingClamped = { ...incoming, updatedAt: at };
  if (!existing) {
    return { applied: incomingClamped, discarded: null, clamped };
  }
  if (existing.clientMutationId === incoming.clientMutationId) {
    return { applied: existing, discarded: null, clamped };
  }
  const incomingWins =
    incomingClamped.updatedAt > existing.updatedAt ||
    (incomingClamped.updatedAt === existing.updatedAt && incomingClamped.deviceId > existing.deviceId);
  if (incomingWins) {
    return { applied: incomingClamped, discarded: null, clamped };
  }
  return { applied: existing, discarded: incomingClamped, clamped };
}
