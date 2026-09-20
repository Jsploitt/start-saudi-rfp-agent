import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * The horizontal lockup.
 *
 * The asset is `mark-color.png`, not either of the files called "horizontal" —
 * per brand/logo-usage.md those two are mark-only and identical to each other,
 * and the suffix refers to the colour of the ink rather than the background.
 * `-color` is the navy-inked lockup, so it belongs on a light surface; on navy
 * the file is `mark-light.png`.
 *
 * Both are padded into a 1080² box and are 93% transparent, so the art is
 * cropped to its measured content box (105,402 → 870×276) by the .lockup class
 * rather than sized by the image's own dimensions.
 */
export function Lockup({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Start Saudi"
      className={cn('lockup', className)}
      style={{
        backgroundImage: `url(/assets/${onDark ? 'mark-light' : 'mark-color'}.png)`,
      }}
    />
  );
}

export function AppShell({
  children,
  mode,
  right,
  breadcrumb,
}: {
  children: ReactNode;
  mode?: string | null;
  right?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--ss-surface-soft)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-md"
      >
        Skip to content
      </a>

      <header className="flex flex-wrap items-center gap-4 border-b border-hairline bg-surface px-6 py-3">
        <Link to="/" className="flex items-center gap-4 rounded-md" aria-label="Proposal agent, home">
          <Lockup className="[--lw:118px]" />
          <span className="hidden text-xs font-semibold uppercase tracking-display text-ink-muted sm:inline">
            Proposal agent
          </span>
        </Link>

        {breadcrumb ? (
          <>
            <span aria-hidden="true" className="text-ink-muted">
              /
            </span>
            <div className="min-w-0">{breadcrumb}</div>
          </>
        ) : null}

        <span className="flex-1" />

        {/* Shown only when it is not a live run, because then it matters. */}
        {mode ? <Badge tone="caution">{mode}</Badge> : null}
        {right}
      </header>

      {/* Below lg the page scrolls and panels take their natural height; at lg
          and above it becomes a fixed-height workspace whose panels scroll
          individually. Forcing the second shape onto a phone collapses every
          flex child to nothing. */}
      <main id="main" className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
        {children}
      </main>
    </div>
  );
}
