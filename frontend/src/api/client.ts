import { getRuntimeConfig } from './runtimeConfig';
import { getAccessToken } from './authToken';
import { getCaregiverName } from './caregiverName';
import type {
  BabyConfig,
  CreateEventRequest,
  Event,
  GetEventsQuery,
  GetEventsResponse,
  PushSubscribeRequest,
  UpdateConfigRequest,
  UpdateEventRequest,
  VapidPublicKeyResponse,
} from './types';

/** Dispatched on window whenever a request comes back 401, so AuthContext can log out. */
export const UNAUTHORIZED_EVENT = 'babyTracker:unauthorized';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as Record<string, unknown>).error;
    if (typeof err === 'string' && err) return err;
  }
  return `Request failed (${status})`;
}

function buildQueryString(query?: Record<string, string | undefined>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { apiUrl } = await getRuntimeConfig();
  const { method = 'GET', body, query } = options;

  const headers = new Headers();
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const token = await getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    const name = getCaregiverName();
    if (name) {
      // Header values must be Latin-1; encode to safely carry names/emails
      // with accents or other non-ASCII characters.
      headers.set('X-Caregiver-Name', encodeURIComponent(name));
    }
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}${buildQueryString(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Network error - could not reach the server.');
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(401, 'Your session has expired. Please log in again.');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(data, res.status));
  }

  return data as T;
}

// ---- events ----

export function createEvent(body: CreateEventRequest): Promise<Event> {
  return request<Event>('/events', { method: 'POST', body });
}

export function getEvents(query: GetEventsQuery = {}): Promise<GetEventsResponse> {
  return request<GetEventsResponse>('/events', { query });
}

export function updateEvent(id: string, body: UpdateEventRequest): Promise<Event> {
  return request<Event>(`/events/${encodeURIComponent(id)}`, { method: 'PATCH', body });
}

export function deleteEvent(id: string, startTime: string): Promise<void> {
  return request<void>(`/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    query: { startTime },
  });
}

// ---- config ----

export function getConfig(): Promise<BabyConfig> {
  return request<BabyConfig>('/config');
}

export function updateConfig(body: UpdateConfigRequest): Promise<BabyConfig> {
  return request<BabyConfig>('/config', { method: 'PATCH', body });
}

// ---- push ----

export function getVapidPublicKey(): Promise<VapidPublicKeyResponse> {
  return request<VapidPublicKeyResponse>('/push/vapid-public-key');
}

export function subscribePush(body: PushSubscribeRequest): Promise<{ ok: true }> {
  return request<{ ok: true }>('/push/subscribe', { method: 'POST', body });
}
