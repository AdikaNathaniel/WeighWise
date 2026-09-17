'use client';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted">
      <span>
        Showing {from}–{to} of {total} subgroups
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:text-foreground disabled:opacity-40 disabled:hover:text-muted"
        >
          Previous
        </button>
        <span className="text-foreground">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:text-foreground disabled:opacity-40 disabled:hover:text-muted"
        >
          Next
        </button>
      </div>
    </div>
  );
}
