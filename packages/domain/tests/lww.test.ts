import { lastWriteWins } from '../src/lww';

const now = Date.parse('2026-11-11T12:00:00Z');

const a = {
  value: { done: true },
  updatedAt: now,
  deviceId: 'device-a',
  clientMutationId: 'm1',
  doneBy: 'doc-a',
};

describe('last-write-wins', () => {
  it('inserts when empty', () => {
    const r = lastWriteWins(null, a, now);
    expect(r.applied).toEqual(a);
    expect(r.discarded).toBeNull();
  });

  it('keeps the later timestamp', () => {
    const b = { ...a, value: { done: false }, updatedAt: now + 1000, deviceId: 'device-b', clientMutationId: 'm2', doneBy: 'doc-b' };
    const r = lastWriteWins(a, b, now + 2000);
    expect(r.applied.doneBy).toBe('doc-b');
    expect(r.discarded).toBeNull();
  });

  it('discards the older write and keeps both payloads via discarded', () => {
    const newer = { ...a, updatedAt: now + 5000, clientMutationId: 'm-new' };
    const r = lastWriteWins(newer, a, now + 6000);
    expect(r.applied.clientMutationId).toBe('m-new');
    expect(r.discarded?.clientMutationId).toBe('m1');
  });

  it('on a tie, the smaller device_id loses', () => {
    const b = { ...a, deviceId: 'device-z', clientMutationId: 'm2', doneBy: 'doc-b' };
    const r = lastWriteWins(a, b, now);
    expect(r.applied.deviceId).toBe('device-z');
  });

  it('clamps timestamps more than 2 minutes in the future', () => {
    const future = { ...a, updatedAt: now + 10 * 60 * 1000, clientMutationId: 'm-future' };
    const r = lastWriteWins(null, future, now);
    expect(r.clamped).toBe(true);
    expect(r.applied.updatedAt).toBe(now);
  });

  it('is idempotent for the same mutation id', () => {
    const r = lastWriteWins(a, { ...a, value: { done: false } }, now);
    expect(r.applied.value).toEqual({ done: true });
    expect(r.discarded).toBeNull();
  });
});
