export function Header() {
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto max-w-5xl px-4 py-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 font-bold">
          W
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight">WeighWise</h1>
          <p className="text-xs text-white/80 leading-tight">Package Weight SPC Dashboard</p>
        </div>
      </div>
    </header>
  );
}
