import Image from 'next/image';

export function Header() {
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 flex items-center gap-3">
        <Image
          src="/processwise-logo.png"
          alt="ProcessWise logo"
          width={40}
          height={40}
          priority
          className="h-10 w-10 rounded-lg object-cover ring-2 ring-white/30"
        />
        <div>
          <h1 className="text-lg font-semibold leading-tight">ProcessWise</h1>
          <p className="text-xs text-white/80 leading-tight">Weight &amp; Colour SPC Dashboard</p>
        </div>
      </div>
    </header>
  );
}
