import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LogRow } from '@/types';

/**
 * The activity log. In the old UI this held the middle 25% of the screen at
 * all times; it is now a drawer, because it is reference material rather than
 * the thing an operator watches.
 *
 * `aria-live="polite"` on the list means a screen reader hears each new row as
 * it lands without being interrupted mid-sentence. Rows that collapse into an
 * existing row are not re-announced, which is the right behaviour: "Checking
 * the library, ×7" read out seven times is noise, not information.
 */
export function ActivityLog({ rows, className }: { rows: LogRow[]; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  /* Scrolls its own container rather than calling scrollIntoView, which would
     scroll the drawer and the page behind it as well. Pinning is released as
     soon as the operator scrolls up, so reading an older row is not fought
     by every new event that lands. */
  useEffect(() => {
    const el = scrollRef.current;
    if (pinned && el) el.scrollTop = el.scrollHeight;
  }, [rows, pinned]);

  if (!rows.length) {
    return (
      <p className={cn('px-6 py-8 text-sm text-ink-muted', className)}>
        Nothing yet. Every tool call, section and finding will be listed here as it happens.
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn('scroll-thin overflow-y-auto', className)}
      onScroll={(e) => {
        const el = e.currentTarget;
        setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
      }}
    >
      <ol className="flex flex-col" aria-live="polite" aria-relevant="additions">
        {rows.map((row) => (
          <LogRowView key={row.id} row={row} />
        ))}
      </ol>
    </div>
  );
}

/** Rows that deserve to stand out do so by weight and a tinted edge, not colour alone. */
const EDGE: Record<string, string> = {
  error: 'border-l-[color:var(--ss-danger)]',
  warn: 'border-l-[color:var(--ss-caution)]',
  review: 'border-l-[color:var(--ss-caution)]',
  'section:done': 'border-l-[color:var(--ss-accent)]',
  done: 'border-l-[color:var(--ss-accent)]',
  pdf: 'border-l-[color:var(--ss-accent)]',
};

function LogRowView({ row }: { row: LogRow }) {
  const [open, setOpen] = useState(false);
  const detail = row.details.join('  ·  ');
  const hasDetail = detail.length > 0;

  const body = (
    <>
      <span className="w-10 shrink-0 pt-px text-right text-xs tabular-nums text-ink-muted">
        {row.tSeconds === null ? '' : `${row.tSeconds}s`}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-ink">
          {row.what}
          {row.count > 1 ? (
            <span className="ml-1.5 rounded-full bg-surface-raised px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink-muted">
              ×{row.count}
            </span>
          ) : null}
        </span>
        {hasDetail ? (
          <span
            className={cn(
              'mt-0.5 block text-xs text-ink-muted',
              open ? 'whitespace-pre-wrap' : 'truncate'
            )}
            title={open ? undefined : detail}
          >
            {detail}
          </span>
        ) : null}
      </span>
    </>
  );

  const className = cn(
    'flex w-full gap-3 border-l-2 border-l-transparent px-5 py-2 text-left animate-fade-up',
    'hover:bg-surface-raised',
    EDGE[row.kind]
  );

  return (
    <li>
      {hasDetail ? (
        <button type="button" className={className} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {body}
        </button>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}
