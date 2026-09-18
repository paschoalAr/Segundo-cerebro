export function isAllowedEmail(
  email: string | null | undefined,
  allowed = process.env.ALLOWED_EMAIL ?? '',
): boolean {
  const a = allowed.trim().toLowerCase();
  const e = (email ?? '').trim().toLowerCase();
  return a !== '' && e === a;
}
