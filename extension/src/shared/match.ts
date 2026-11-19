// Decides whether a URL belongs to a preset. Pure functions, easy to test.

/** Turn whatever the user typed ("https://www.GitHub.com/") into "github.com". */
export function normalizePattern(raw: string): string {
  let p = raw.trim().toLowerCase();
  if (!p) return '';
  p = p.replace(/^[a-z]+:\/\//, ''); // drop scheme
  p = p.replace(/^www\./, '');
  p = p.replace(/[?#].*$/, ''); // drop query/hash
  p = p.replace(/\/+$/, ''); // drop trailing slash
  return p;
}

/** Pages that should never count as "distracted": new tab, settings, our own pages. */
export function isNeutralUrl(url: string): boolean {
  if (!url) return true;
  return !/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * "github.com" matches github.com and any subdomain (gist.github.com).
 * "docs.google.com/document" also requires the path to start with /document.
 */
export function matchesPattern(url: string, pattern: string): boolean {
  const p = normalizePattern(pattern);
  if (!p) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const slash = p.indexOf('/');
  const pHost = slash === -1 ? p : p.slice(0, slash);
  const pPath = slash === -1 ? '' : p.slice(slash);
  const hostOk = host === pHost || host.endsWith('.' + pHost);
  if (!hostOk) return false;
  if (!pPath) return true;
  const path = u.pathname.toLowerCase();
  return path.startsWith(pPath);
}

export function matchesAny(url: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesPattern(url, p));
}
