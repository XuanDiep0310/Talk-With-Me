import { resolveAvatarUrl } from './avatar.utils';
import { environment } from '../../../environments/environment';

describe('resolveAvatarUrl', () => {
  const originalApiUrl = environment.apiUrl;

  afterEach(() => {
    environment.apiUrl = originalApiUrl;
  });

  it('returns null for empty or null input', () => {
    expect(resolveAvatarUrl(null)).toBeNull();
    expect(resolveAvatarUrl(undefined)).toBeNull();
    expect(resolveAvatarUrl('')).toBeNull();
  });

  it('returns full http/https URLs as-is', () => {
    const googleAvatar = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    expect(resolveAvatarUrl(googleAvatar)).toBe(googleAvatar);
  });

  it('resolves relative URLs against environment.apiUrl origin when apiUrl is absolute', () => {
    environment.apiUrl = 'https://p01--backend-api--w8mz8twm78d4.code.run/api/v1';
    const relativePath = '/api/v1/static/avatars/user-123.jpg?t=1795510911';
    expect(resolveAvatarUrl(relativePath)).toBe(
      'https://p01--backend-api--w8mz8twm78d4.code.run/api/v1/static/avatars/user-123.jpg?t=1795510911'
    );
  });

  it('resolves relative URLs cleanly when apiUrl is relative', () => {
    environment.apiUrl = '/api/v1';
    const relativePath = '/api/v1/static/avatars/user-123.jpg';
    expect(resolveAvatarUrl(relativePath)).toBe('/api/v1/static/avatars/user-123.jpg');
  });
});
