import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FileDown, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, PanelHeading } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { RunState } from '@/types';

/**
 * The live document.
 *
 * Two things here are load-bearing and were carried over from the old UI
 * rather than reinvented:
 *
 * 1. Reloads coalesce on a 120ms timer. Sections can land faster than a frame
 *    can load — several `preview` events inside one animation frame is normal
 *    during composing — and without the timer the iframe thrashes and the
 *    operator watches a blank frame instead of a document.
 *
 * 2. The reload carries the target section in the hash and a cache-busting
 *    query. The deck reads its own hash on load, so a fresh src does the whole
 *    job: no postMessage handshake to get wrong, and no stale frame if one is
 *    missed.
 */

const COALESCE_MS = 120;

export function DocumentPanel({
  state,
  onExport,
  exporting,
  className,
}: {
  state: RunState;
  onExport(): void;
  exporting: boolean;
  className?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Which section the frame is showing, and whether it should keep up with
     the agent. Navigating by hand stops it following; the badge says so and
     one click puts it back. */
  const [viewing, setViewing] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);

  /** Sections that exist in the document and can therefore be navigated to. */
  const pages = state.outline.filter((s) => state.sectionState[s.id] === 'done');
  const currentIndex = viewing ? pages.findIndex((s) => s.id === viewing) : pages.length - 1;

  const load = useCallback((url: string, sectionId: string | null, immediate = false) => {
    const go = () => {
      const frame = frameRef.current;
      if (!frame) return;
      frame.src = `${url}?t=${Date.now()}${sectionId ? `#sec-${sectionId}` : ''}`;
    };
    if (pending.current) clearTimeout(pending.current);
    if (immediate) go();
    else pending.current = setTimeout(go, COALESCE_MS);
  }, []);

  /* The agent moved the document on. Follow it, unless told not to. */
  useEffect(() => {
    if (!state.previewUrl || !following) return;
    setViewing(state.previewSectionId);
    load(state.previewUrl, state.previewSectionId);
  }, [state.previewUrl, state.previewSectionId, following, load]);

  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);

  const goTo = (index: number) => {
    const target = pages[index];
    if (!target || !state.previewUrl) return;
    setFollowing(false);
    setViewing(target.id);
    load(state.previewUrl, target.id, true);
  };

  const resume = () => {
    setFollowing(true);
    if (state.previewUrl) {
      setViewing(state.previewSectionId);
      load(state.previewUrl, state.previewSectionId, true);
    }
  };

  const fullUrl = state.previewUrl
    ? `${state.previewUrl}${viewing ? `#sec-${viewing}` : ''}`
    : null;

  return (
    <section className={cn('flex min-h-0 flex-col bg-surface', className)} aria-label="The proposal">
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-6 py-3">
        <PanelHeading>The proposal</PanelHeading>
        {state.sectionsTotal > 0 ? (
          <Badge tone="neutral">
            {state.sectionsDone} / {state.sectionsTotal}
          </Badge>
        ) : null}
        {!following ? (
          <Button size="sm" variant="secondary" onClick={resume}>
            <Radio aria-hidden="true" />
            Follow the agent
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={onExport}
          disabled={exporting || state.sectionsDone === 0}
        >
          <FileDown aria-hidden="true" />
          {exporting ? 'Printing…' : 'PDF'}
        </Button>
        <Button size="sm" variant="ghost" asChild disabled={!fullUrl}>
          {fullUrl ? (
            <a href={fullUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Full screen
            </a>
          ) : (
            <span>
              <ExternalLink aria-hidden="true" />
              Full screen
            </span>
          )}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-6">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-raised ring-1 ring-hairline">
          <iframe
            ref={frameRef}
            title="Proposal preview"
            src="about:blank"
            className="absolute inset-0 h-full w-full border-0"
          />
          {!state.previewUrl ? (
            <div className="absolute inset-0 grid place-items-center p-8 text-center">
              <p className="max-w-sm text-sm text-ink-muted">
                Sections appear here as they are written, and the page turns to each one as it
                lands.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Page navigation. Only over sections that actually exist. */}
      <nav
        className="flex items-center gap-3 border-t border-hairline px-6 py-3"
        aria-label="Document pages"
      >
        <Button
          size="icon"
          variant="outline"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex <= 0}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex < 0 || currentIndex >= pages.length - 1}
          aria-label="Next page"
        >
          <ChevronRight aria-hidden="true" />
        </Button>

        <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
          {pages.length === 0
            ? 'No pages yet'
            : `${Math.max(1, currentIndex + 1)} of ${pages.length} — ${
                pages[Math.max(0, currentIndex)]?.title ?? ''
              }`}
        </p>

        <p className="hidden shrink-0 text-xs text-ink-muted lg:block">
          Inside the preview: <b className="font-semibold text-ink">←</b>{' '}
          <b className="font-semibold text-ink">→</b> navigate ·{' '}
          <b className="font-semibold text-ink">E</b> edit ·{' '}
          <b className="font-semibold text-ink">P</b> print
        </p>
      </nav>
    </section>
  );
}
