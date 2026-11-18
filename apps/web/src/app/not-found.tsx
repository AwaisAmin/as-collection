import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="text-sm tracking-[0.35em] uppercase opacity-70">404</p>
      <h1 className="text-3xl">Page not found</h1>
      <p className="max-w-md opacity-80">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link
        href="/"
        className="rounded-full border border-[#c9a35e] bg-[#111010] px-8 py-3 text-white transition-opacity hover:opacity-90"
      >
        Back to Home
      </Link>
    </main>
  );
}
