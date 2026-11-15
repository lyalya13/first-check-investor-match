/** A later error must never erase deals already delivered for the current search. */
export function preserveArrivedResults<T extends { ok: boolean; partial?: boolean; enrichmentPending?: boolean }, F>(current: T | null, failure: F): T | F {
  return current?.ok ? { ...current, partial: true, enrichmentPending: false } : failure;
}