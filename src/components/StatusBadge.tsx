export function StatusBadge({ isStable }: { isStable: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
        isStable ? 'bg-primary-soft text-primary-hover' : 'bg-red-100 text-red-800'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isStable ? 'bg-primary' : 'bg-red-600'}`} />
      {isStable ? 'Process stable' : 'Process not stable'}
    </span>
  );
}
