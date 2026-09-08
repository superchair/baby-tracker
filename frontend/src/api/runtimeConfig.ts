// Resolves the API base URL at runtime.
//
// The API's base URL is not known at build time - CDK publishes /config.json
// at the site root at deploy time, shaped { "apiUrl": "https://..." }.
// We fetch that once, cache the result in a module-level promise, and fall
// back to VITE_API_URL (see .env.local.example) for local dev when
// /config.json is missing (e.g. 404 from `vite dev`).

export interface RuntimeConfig {
  apiUrl: string;
}

let configPromise: Promise<RuntimeConfig> | null = null;

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function loadConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (res.ok) {
      const data: unknown = await res.json();
      if (
        data &&
        typeof data === 'object' &&
        'apiUrl' in data &&
        typeof (data as { apiUrl: unknown }).apiUrl === 'string' &&
        (data as { apiUrl: string }).apiUrl.length > 0
      ) {
        return { apiUrl: stripTrailingSlash((data as { apiUrl: string }).apiUrl) };
      }
    }
  } catch {
    // /config.json missing or unreachable - fall through to the dev fallback below.
  }

  const fallback = import.meta.env.VITE_API_URL;
  if (fallback) {
    return { apiUrl: stripTrailingSlash(fallback) };
  }

  throw new Error(
    'No API URL is configured. Deploy /config.json alongside the app, or set ' +
      'VITE_API_URL in .env.local for local development (see .env.local.example).',
  );
}

/** Resolves the API base URL, fetching /config.json at most once. */
export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!configPromise) {
    configPromise = loadConfig();
  }
  return configPromise;
}

/** Test/dev helper to force re-resolution (e.g. after a failed attempt). */
export function resetRuntimeConfig(): void {
  configPromise = null;
}
