// =====================================================
// API Client - Centralized fetch wrapper
// =====================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://iptv.kukey.com/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Auto-refresh on 401
  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({ message: 'Request failed' }));
        throw new ApiError(retry.status, err.message || 'Request failed');
      }
      return retry.json();
    }
    // Refresh failed - clear token and redirect
    setAccessToken(null);
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(res.status, err.message || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// ---- Auth API ----
export const authApi = {
  login: (body: { username: string; password: string; totpCode?: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  refresh: () =>
    request<any>('/auth/refresh', { method: 'POST' }),

  logout: () =>
    request<any>('/auth/logout', { method: 'POST' }),

  logoutAll: () =>
    request<any>('/auth/logout-all', { method: 'POST' }),

  profile: () =>
    request<any>('/auth/profile'),

  sessions: () =>
    request<any>('/auth/sessions'),

  revokeSession: (id: string) =>
    request<any>(`/auth/sessions/${id}`, { method: 'DELETE' }),

  loginHistory: () =>
    request<any>('/auth/login-history'),

  totpSetup: () =>
    request<any>('/auth/totp/setup'),

  totpConfirm: (totpCode: string) =>
    request<any>('/auth/totp/confirm', { method: 'POST', body: JSON.stringify({ totpCode }) }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<any>('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
};

// ---- Playlists API ----
export const playlistsApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/playlists${qs}`);
  },
  get: (id: string) => request<any>(`/playlists/${id}`),
  create: (body: any) => request<any>('/playlists', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) => request<any>(`/playlists/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) => request<any>(`/playlists/${id}`, { method: 'DELETE' }),
  sync: (id: string) => request<any>(`/playlists/${id}/sync`, { method: 'POST' }),
  tags: () => request<any>('/playlists/tags'),
  bulkImport: (body: any) => request<any>('/playlists/bulk-import', { method: 'POST', body: JSON.stringify(body) }),
};

// ---- Channels API ----
export const channelsApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/channels${qs}`);
  },
  get: (id: string) => request<any>(`/channels/${id}`),
  toggle: (id: string, enabled: boolean) =>
    request<any>(`/channels/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  groups: (playlistId?: string) => {
    const qs = playlistId ? `?playlistId=${playlistId}` : '';
    return request<any>(`/channels/groups${qs}`);
  },
  healthStats: (playlistId?: string) => {
    const qs = playlistId ? `?playlistId=${playlistId}` : '';
    return request<any>(`/channels/health-stats${qs}`);
  },
};

// ---- Outputs API ----
export const outputsApi = {
  list: () => request<any>('/output'),
  get: (id: string) => request<any>(`/output/${id}`),
  create: (body: any) => request<any>('/output', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) => request<any>(`/output/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) => request<any>(`/output/${id}`, { method: 'DELETE' }),
  regenerateToken: (id: string) =>
    request<any>(`/output/${id}/regenerate-token`, { method: 'POST' }),
};

// ---- Admin API ----
export const adminApi = {
  stats: () => request<any>('/admin/stats'),
  auditLogs: () => request<any>('/admin/audit-logs'),
  systemInfo: () => request<any>('/admin/system-info'),
};
