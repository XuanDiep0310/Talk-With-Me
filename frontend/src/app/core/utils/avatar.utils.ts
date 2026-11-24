import { environment } from '../../../environments/environment';

export function resolveAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) {
    const origin = environment.apiUrl.startsWith('http') ? new URL(environment.apiUrl).origin : '';
    return `${origin}${raw}`;
  }
  return raw;
}
