import {
  ArchivedSubgroupSet,
  CreateSubgroupInput,
  DashboardData,
  ImportSubgroupsResult,
  RestoreSubgroupsResult,
  PaginatedSubgroups,
  ReviewSubgroupInput,
  Subgroup,
  SubgroupReview,
  UpdateSubgroupInput,
} from '@/types/spc';
import {
  ClearColourBatchesResult,
  ClearedColourBatch,
  ColourBatch,
  ColourBatchInput,
  PChartData,
  RestoreColourBatchesResult,
} from '@/types/pChart';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001';

// A sleeping Render instance can take about a minute to wake, so allow for
// that, but never leave the page on "Loading…" when the backend is down.
const REQUEST_TIMEOUT_MS = 90_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(
        'The ProcessWise server did not respond. It may be starting up or offline — try again in a minute.',
      );
    }
    throw err;
  }

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

/** Spreadsheet upload: these subgroups replace the active set (the old set is archived). */
export function importSubgroups(subgroups: CreateSubgroupInput[]): Promise<ImportSubgroupsResult> {
  return request<ImportSubgroupsResult>('/subgroups/import', {
    method: 'POST',
    body: JSON.stringify({ subgroups }),
  });
}

export function fetchArchivedSubgroups(): Promise<ArchivedSubgroupSet[]> {
  return request<ArchivedSubgroupSet[]>('/subgroups/archived');
}

export function restoreSubgroups(archivedAt: string): Promise<RestoreSubgroupsResult> {
  return request<RestoreSubgroupsResult>('/subgroups/restore', {
    method: 'POST',
    body: JSON.stringify({ archivedAt }),
  });
}

export function fetchSubgroupsPage(page: number, pageSize: number): Promise<PaginatedSubgroups> {
  return request<PaginatedSubgroups>(`/subgroups/page?page=${page}&pageSize=${pageSize}`);
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

/** Records the investigation of a subgroup's signal; a confirmed cause may exclude it. */
export function reviewSubgroup(id: string, input: ReviewSubgroupInput): Promise<SubgroupReview> {
  return request<SubgroupReview>(`/subgroups/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Reopens a review (an excluded subgroup counts toward the limits again); it stays in the history. */
export function reopenReview(id: string): Promise<{ id: string; reopened: number }> {
  return request<{ id: string; reopened: number }>(`/subgroups/${id}/review`, {
    method: 'DELETE',
  });
}

export function fetchPChart(): Promise<PChartData> {
  return request<PChartData>('/p-chart');
}

export function createColourBatch(input: ColourBatchInput): Promise<ColourBatch> {
  return request<ColourBatch>('/colour-batches', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateColourBatch(id: string, input: ColourBatchInput): Promise<ColourBatch> {
  return request<ColourBatch>(`/colour-batches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteColourBatch(id: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/colour-batches/${id}`, { method: 'DELETE' });
}

/** Archives every batch; they stay retrievable through the two calls below. */
export function clearColourBatches(): Promise<ClearColourBatchesResult> {
  return request<ClearColourBatchesResult>('/colour-batches', { method: 'DELETE' });
}

export function fetchClearedColourBatches(): Promise<ClearedColourBatch[]> {
  return request<ClearedColourBatch[]>('/colour-batches/cleared');
}

/** Restores the most recent clear, or the clear identified by `clearedAt`. */
export function restoreColourBatches(clearedAt?: string): Promise<RestoreColourBatchesResult> {
  return request<RestoreColourBatchesResult>('/colour-batches/restore', {
    method: 'POST',
    body: JSON.stringify(clearedAt ? { clearedAt } : {}),
  });
}
