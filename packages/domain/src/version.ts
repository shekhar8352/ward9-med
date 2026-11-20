export const CLIENT_VERSION = '1.0.0';

export function parseSemver(v: string): [number, number, number] {
  const [a, b, c] = String(v)
    .split('.')
    .map((n) => parseInt(n, 10));
  return [a || 0, b || 0, c || 0];
}

export function isClientAllowed(minVersion: string, current: string = CLIENT_VERSION): boolean {
  const min = parseSemver(minVersion);
  const cur = parseSemver(current);
  for (let i = 0; i < 3; i++) {
    if (cur[i] > min[i]) return true;
    if (cur[i] < min[i]) return false;
  }
  return true;
}

export function compareClientColumns<T extends Record<string, unknown>>(
  row: T,
  known: (keyof T)[],
): { known: Partial<T>; ignored: string[] } {
  const ignored: string[] = [];
  const out: Partial<T> = {};
  for (const key of Object.keys(row)) {
    if ((known as string[]).includes(key)) {
      out[key as keyof T] = row[key as keyof T];
    } else {
      ignored.push(key);
    }
  }
  return { known: out, ignored };
}
