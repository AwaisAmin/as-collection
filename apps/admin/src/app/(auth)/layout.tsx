/** Sign-in and password pages: a single centred card, no navigation. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-brand text-[28px] leading-none text-ink">AS Collection Hub</p>
          <p className="mt-2 text-[13px] font-medium tracking-[0.18em] text-gold-dark uppercase">
            Staff admin
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
