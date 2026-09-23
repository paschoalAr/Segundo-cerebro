export function planFactSync<T extends { sourceRef: string }>(existingRefs: string[], incoming: T[]) {
  const seen = new Set(incoming.map((i) => i.sourceRef));
  return {
    upserts: incoming,
    deletes: existingRefs.filter((ref) => !seen.has(ref)),
  };
}
