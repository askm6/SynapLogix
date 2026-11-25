/**
 * SynapLogix logo with its tagline. Provisional mark until the official files are added to public/brand;
 * the wordmark uses currentColor, so it is white on the dark theme and black on the light theme (RNF-08).
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/synaplogix-mark.svg" alt="" className="size-9 rounded-lg" />
      {!compact && (
        <div className="leading-tight">
          <div className="text-base font-semibold tracking-tight text-fg">
            Synap<span className="text-accent-ink">Logix</span>
          </div>
          <div className="text-[11px] text-muted">Intelligent routes. Smarter Logistics.</div>
        </div>
      )}
    </div>
  );
}
