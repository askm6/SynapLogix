/** Small glassmorphism UI kit shared by every screen. */
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function Card({
  title,
  actions,
  children,
  className,
  padded = true,
  solid = false,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /**
   * Opaque panel without the backdrop blur. Use it around content that repaints constantly (the
   * animated map), where re-blurring the background on every frame would cost frame rate.
   */
  solid?: boolean;
}) {
  return (
    <section
      className={cx(
        'rounded-2xl shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset]',
        solid ? 'border border-line bg-glass-strong' : 'glass',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2">
          {title && <h2 className="text-sm font-semibold tracking-wide text-fg">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(padded && 'px-5 pb-5', !title && !actions && padded && 'pt-5')}>{children}</div>
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    icon?: ReactNode;
    loading?: boolean;
    size?: 'sm' | 'md';
  }
>(function Button(
  { variant = 'secondary', icon, loading, size = 'md', className, children, disabled, ...rest },
  ref,
) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-on-accent hover:brightness-110 shadow-[0_0_24px_-6px_var(--accent)]',
    secondary: 'glass text-fg hover:bg-white/10',
    ghost: 'text-muted hover:text-fg hover:bg-white/5',
    danger: 'text-danger hover:bg-danger/10',
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        styles[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-xl border border-line bg-glass px-3 text-sm text-fg placeholder:text-muted/70 ' +
  'focus:border-accent focus:outline-none aria-[invalid=true]:border-danger';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { suffix?: string }
>(function Input({ className, suffix, ...rest }, ref) {
  if (!suffix) return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
  return (
    <div className="relative">
      <input ref={ref} className={cx(inputClass, 'pr-14', className)} {...rest} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">
        {suffix}
      </span>
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx(inputClass, 'pr-8 [&>option]:bg-glass-strong [&>option]:text-fg', className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-white/5 text-muted border-line',
    accent: 'bg-accent/10 text-accent-ink border-accent/30',
    ok: 'bg-ok/10 text-ok border-ok/30',
    warn: 'bg-warn/10 text-warn border-warn/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'ok' | 'warn' | 'danger';
  children: ReactNode;
}) {
  const map = {
    info: { icon: Info, cls: 'border-accent/30 text-accent-ink' },
    ok: { icon: CheckCircle2, cls: 'border-ok/30 text-ok' },
    warn: { icon: AlertTriangle, cls: 'border-warn/30 text-warn' },
    danger: { icon: XCircle, cls: 'border-danger/30 text-danger' },
  }[tone];
  const Icon = map.icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('glass flex items-start gap-2 rounded-xl px-3 py-2 text-sm', map.cls)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-fg/90">{children}</div>
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
    >
      <div
        className="h-full rounded-full bg-accent shadow-[0_0_16px_var(--accent)] transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="glass flex min-w-0 flex-col gap-1 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-semibold tabular-nums text-fg">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="glass inline-flex flex-wrap gap-1 rounded-xl p-1">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm transition',
            value === item.value ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-6 text-sm text-muted">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Scrollable table wrapper with sticky header styling. */
export function TableWrap({ children, maxHeight }: { children: ReactNode; maxHeight?: number }) {
  return (
    <div
      className="overflow-auto rounded-xl border border-line"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full min-w-max border-collapse text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-glass-strong [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted [&_th]:backdrop-blur [&_tbody_tr]:border-t [&_tbody_tr]:border-line">
        {children}
      </table>
    </div>
  );
}
