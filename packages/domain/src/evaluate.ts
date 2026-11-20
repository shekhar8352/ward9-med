import type { Condition, EvalContext, EvalResult } from './types';

const KNOWN_OPS = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'in',
  'exists',
  'and',
  'or',
  'not',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function resolvePath(ctx: EvalContext, path: string): unknown {
  if (!path || typeof path !== 'string') {
    throw new Error(`unknown path: ${String(path)}`);
  }
  const firstDot = path.indexOf('.');
  if (firstDot === -1) {
    if (!(path in ctx)) {
      throw new Error(`unknown path: ${path}`);
    }
    return (ctx as Record<string, unknown>)[path];
  }
  const root = path.slice(0, firstDot);
  const rest = path.slice(firstDot + 1);
  const rootVal = (ctx as Record<string, unknown>)[root];
  if (rootVal === undefined) {
    throw new Error(`unknown path: ${path}`);
  }
  // entries keys contain dots (blood.cleared, __fitness_any__, fitness.cardio)
  if (root === 'entries') {
    if (!isPlainObject(rootVal) || !(rest in rootVal)) {
      throw new Error(`unknown path: ${path}`);
    }
    return rootVal[rest];
  }
  let current: unknown = rootVal;
  for (const part of rest.split('.')) {
    if (!isPlainObject(current) || !(part in current)) {
      throw new Error(`unknown path: ${path}`);
    }
    current = current[part];
  }
  return current;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  const an = asNumber(a);
  const bn = asNumber(b);
  if (an !== null && bn !== null && typeof a !== 'boolean' && typeof b !== 'boolean') {
    return an === bn;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Boolean(a) === Boolean(b) && typeof a === 'boolean' && typeof b === 'boolean'
      ? a === b
      : String(a) === String(b);
  }
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b) || String(a) === String(b);
}

function compareOrdered(op: 'gt' | 'gte' | 'lt' | 'lte', left: unknown, right: unknown): boolean {
  const ln = asNumber(left);
  const rn = asNumber(right);
  if (ln === null || rn === null) {
    throw new Error(`cannot compare ${String(left)} ${op} ${String(right)}`);
  }
  switch (op) {
    case 'gt':
      return ln > rn;
    case 'gte':
      return ln >= rn;
    case 'lt':
      return ln < rn;
    case 'lte':
      return ln <= rn;
  }
}

function evalInner(cond: Condition, ctx: EvalContext): boolean {
  if (!cond || typeof cond !== 'object' || !('op' in cond)) {
    throw new Error('unknown operator: missing');
  }
  const op = cond.op;
  if (!KNOWN_OPS.has(op)) {
    throw new Error(`unknown operator: ${String(op)}`);
  }
  switch (cond.op) {
    case 'and': {
      if (!Array.isArray(cond.args)) throw new Error('and requires args');
      return cond.args.every((c) => evalInner(c, ctx));
    }
    case 'or': {
      if (!Array.isArray(cond.args)) throw new Error('or requires args');
      if (cond.args.length === 0) return false;
      return cond.args.some((c) => evalInner(c, ctx));
    }
    case 'not': {
      if (!cond.arg) throw new Error('not requires arg');
      return !evalInner(cond.arg, ctx);
    }
    case 'exists': {
      const v = resolvePath(ctx, cond.path);
      return v !== null && v !== undefined;
    }
    case 'eq':
      return jsonEqual(resolvePath(ctx, cond.path), cond.value);
    case 'neq':
      return !jsonEqual(resolvePath(ctx, cond.path), cond.value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareOrdered(cond.op, resolvePath(ctx, cond.path), cond.value);
    case 'contains': {
      const v = resolvePath(ctx, cond.path);
      if (Array.isArray(v)) {
        return v.some((item) => jsonEqual(item, cond.value));
      }
      if (typeof v === 'string') {
        return v.includes(String(cond.value));
      }
      return false;
    }
    case 'in': {
      if (!Array.isArray(cond.value)) throw new Error('in requires array value');
      const v = resolvePath(ctx, cond.path);
      return cond.value.some((item) => jsonEqual(item, v));
    }
  }
}

/** Null / undefined condition is true. Unknown operator or path returns ok:false. */
export function evaluate(cond: Condition | null | undefined, ctx: EvalContext): EvalResult {
  if (cond == null) {
    return { ok: true, value: true };
  }
  try {
    return { ok: true, value: evalInner(cond, ctx) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export function evaluateOrThrow(cond: Condition | null | undefined, ctx: EvalContext): boolean {
  const r = evaluate(cond, ctx);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
