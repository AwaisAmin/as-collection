/** Lets keyboard users jump straight to the page content. */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only rounded-full bg-ink px-5 py-2 font-display text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
    >
      Skip to content
    </a>
  );
}
