import { CreateSubgroupInput, DashboardData, Subgroup, UpdateSubgroupInput } from '@/types/spc';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Request to ${path} failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export function fetchDashboard(): Promise<DashboardData> {
  return request<DashboardData>('/dashboard');
}

export function createSubgroup(input: CreateSubgroupInput): Promise<Subgroup> {
  return request<Subgroup>('/subgroups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSubgroup(id: string, input: UpdateSubgroupInput): Promise<Subgroup> {
  return request<Subgroup>(`/subgroups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteSubgroup(id: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/subgroups/${id}`, { method: 'DELETE' });
}
