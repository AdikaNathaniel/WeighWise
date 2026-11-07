/** Process status in words as well as colour, with the reason as its tooltip. */
export function StatusBadge({
  inControl,
  label,
  reason,
}: {
  inControl: boolean;
  label: string;
  reason?: string;
}) {
  return (
    <span
      title={reason}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
        inControl ? 'bg-primary-soft text-primary-hover' : 'bg-red-100 text-red-800'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${inControl ? 'bg-primary' : 'bg-red-600'}`} />
      {label}
    </span>
  );
}
