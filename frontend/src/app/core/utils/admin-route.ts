const id = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const pathPattern = new RegExp(
  '^/admin(?:/(?:categories|coach-topics|gamification|analytics|audit-logs' +
  '|scenarios(?:/(?:new|' + id + '))?|users(?:/' + id + ')?|sessions(?:/' + id + ')?))?/?$',
  'i',
);
const sessionSearch = new RegExp('^userId=' + id + '$', 'i');

export function adminReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const [path, query, extra] = value.split('?');
  if (!pathPattern.test(path) || extra !== undefined) return null;
  if (query === undefined) return value;
  return /^\/admin\/sessions\/?$/i.test(path) && sessionSearch.test(query) ? value : null;
}
