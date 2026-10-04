import { mockAlerts, mockBuildings, mockDashboard, mockDevices } from "./mock-data";

const accessTokenKey = "energyiq.accessToken";
const refreshTokenKey = "energyiq.refreshToken";

export type DashboardPayload = typeof mockDashboard;
export type Alert = (typeof mockAlerts)[number];
export type Building = (typeof mockBuildings)[number];
export type Device = (typeof mockDevices)[number];
export type User = { id: string; email: string; name: string; role: string; organizationId: string | null };
type AuthResponse = { user: User; accessToken: string; refreshToken: string };
export type PageResponse<T> = { items: T[]; total: number; page: number; pageSize: number };

export function getAccessToken() { return localStorage.getItem(accessTokenKey); }
export function clearSession() { localStorage.removeItem(accessTokenKey); localStorage.removeItem(refreshTokenKey); }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(problem?.message ?? `Request failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const result = await request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  localStorage.setItem(accessTokenKey, result.accessToken);
  localStorage.setItem(refreshTokenKey, result.refreshToken);
  return result.user;
}

export async function logout() {
  const refreshToken = localStorage.getItem(refreshTokenKey);
  if (refreshToken) await request<void>("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
  clearSession();
}

export async function getDashboard(): Promise<DashboardPayload> {
  try { return await request<DashboardPayload>("/api/dashboard"); } catch { return mockDashboard; }
}

export async function getBuildings(): Promise<PageResponse<Building>> {
  try { return await request<PageResponse<Building>>("/api/buildings?pageSize=100"); }
  catch { return { items: mockBuildings, total: mockBuildings.length, page: 1, pageSize: 100 }; }
}

export async function getDevices(): Promise<PageResponse<Device>> {
  try { return await request<PageResponse<Device>>("/api/devices?pageSize=100"); }
  catch { return { items: mockDevices, total: mockDevices.length, page: 1, pageSize: 100 }; }
}

export async function getAlerts(): Promise<PageResponse<Alert>> {
  try { return await request<PageResponse<Alert>>("/api/alerts?pageSize=100"); }
  catch { return { items: mockAlerts, total: mockAlerts.length, page: 1, pageSize: 100 }; }
}

export async function updateAlert(id: string, status: "ACKNOWLEDGED" | "RESOLVED") {
  return request<Alert>(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}
