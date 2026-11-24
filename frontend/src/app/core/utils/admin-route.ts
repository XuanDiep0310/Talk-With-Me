export function adminReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^\/admin(?:\/(?:categories|users|scenarios(?:\/(?:new|[\da-f-]{36}))?))?\/?$/i.test(value) ? value : null;
}
