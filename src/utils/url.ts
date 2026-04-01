const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  if (path.startsWith('/')) {
    return `${base}${path}`;
  }
  return path;
}
