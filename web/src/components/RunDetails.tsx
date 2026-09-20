import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RunState } from '@/types';

/**
 * What the agent understood, and what it plans to write. In the old UI these
 * were two permanent cards in the middle column; they are now collapsed
 * sections at the top of the activity drawer.
 *
 * Closed by default, and deliberately so. The drawer is headed "what the agent
 * is doing", and the answer to that is the log — which has to be the thing in
 * view when the drawer opens, not pushed below two panels of reference
 * material. Each one keeps its own bounded height when open so that a
 * seventeen-line outline cannot push the log off the bottom either.
 */

function Disclosure({
  summary,
  count,
  children,
}: {
  summary: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group shrink-0 border-b border-hairline">
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 px-5 py-3',
          'text-xs font-semibold uppercase tracking-display text-ink-muted',
          'hover:bg-surface-raised'
        )}
      >
        <ChevronRight
          className="size-3.5 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        {summary}
        {count ? <span className="font-normal normal-case tracking-normal">{count}</span> : null}
      </summary>
      <div className="scroll-thin max-h-64 overflow-y-auto px-5 pb-4">{children}</div>
    </details>
  );
}

export function RfpFacts({ state }: { state: RunState }) {
  const a = state.rfp;
  if (!a) return null;

  const rows: [string, string][] = [
    ['Client', a.client?.name ?? '—'],
    ['Sector', a.client?.sector || '—'],
    ['Country', a.client?.country || '—'],
    ['Requirements', String(a.requirements?.length ?? 0)],
    ['Key dates', (a.dates ?? []).map((d) => `${d.label}: ${d.date}`).join('\n') || '—'],
    ['Gaps', (a.gaps ?? []).map((g) => `· ${g.question}`).join('\n\n') || '—'],
  ];

  return (
    <Disclosure
      summary="The RFP, read"
      count={`${a.requirements?.length ?? 0} requirements`}
    >
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="min-w-0 whitespace-pre-wrap text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}

export function Outline({ state }: { state: RunState }) {
  if (!state.outline.length) return null;

  return (
    <Disclosure summary="Outline" count={`${state.sectionsDone} of ${state.sectionsTotal} written`}>
      <ol className="flex flex-col gap-1">
        {state.outline.map((s, i) => {
          const status = state.sectionState[s.id] ?? 'pending';
          return (
            <li
              key={s.id}
              title={s.intent}
              className={cn(
                'flex items-baseline gap-2 rounded-sm px-2 py-1 text-sm',
                status === 'done' && 'text-ink',
                status === 'doing' && 'tint-accent font-semibold text-ink',
                status === 'pending' && 'text-ink-muted'
              )}
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className="shrink-0 text-xs text-ink-muted">
                {status === 'done' ? 'written' : status === 'doing' ? 'writing…' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </Disclosure>
  );
}
