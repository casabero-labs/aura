const API_BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_BASE) throw new Error('API not configured');

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  available: () => !!API_BASE,

  settings: {
    list: () => request<{ settings: { key: string; value: Record<string, unknown>; updated_at: string }[] }>('/api/settings'),
    get: (key: string) => request<{ key: string; value: Record<string, unknown>; updated_at: string }>(`/api/settings/${key}`),
    save: (key: string, value: Record<string, unknown>) =>
      request<{ key: string; value: Record<string, unknown>; updated_at: string }>('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      }),
  },
  sessions: {
    list: (limit = 50, offset = 0) =>
      request<{ sessions: unknown[]; limit: number; offset: number }>(`/api/sessions?limit=${limit}&offset=${offset}`),
    get: (id: string) => request(`/api/sessions/${id}`),
    create: (data: Record<string, unknown>) =>
      request('/api/sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  benchmarks: {
    list: (sessionId?: string) =>
      request<{ benchmarks: unknown[] }>(`/api/benchmarks${sessionId ? `?session_id=${sessionId}` : ''}`),
    create: (data: Record<string, unknown>) =>
      request('/api/benchmarks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/api/benchmarks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
};

export function syncToApi<T>(key: string, data: T): void {
  if (!api.available()) return;
  api.settings.save(key, data as unknown as Record<string, unknown>).catch(() => {});
}

export async function loadFromApi<T>(key: string, fallback: T): Promise<T> {
  if (!api.available()) return fallback;
  try {
    const { value } = await api.settings.get(key);
    return value as unknown as T;
  } catch {
    return fallback;
  }
}
