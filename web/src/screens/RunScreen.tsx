import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListTree, Palette, RotateCcw, Square } from 'lucide-react';
import { sessions as api } from '@/api/client';
import { AppShell } from '@/components/AppShell';
import { AgentStatus } from '@/components/AgentStatus';
import { ActivityLog } from '@/components/ActivityLog';
import { Conversation } from '@/components/Conversation';
import { DocumentPanel } from '@/components/DocumentPanel';
import { Outline, RfpFacts } from '@/components/RunDetails';
import { ThemePresetPicker } from '@/components/ThemePresets';
import { Button } from '@/components/ui/button';
import { Badge, PanelHeading } from '@/components/ui/primitives';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useRun } from '@/state/RunProvider';
import type { StatusKind, ThemePresetId } from '@/types';

/**
 * The run screen. Two columns: the conversation on the left, the live document
 * on the right, and the agent's status across the top of both.
 *
 * The activity log used to hold a third of the screen permanently. It is now
 * a drawer — available in one click, and not competing with the document for
 * the operator's attention. What it was really being used for (is anything
 * happening?) is answered better by AgentStatus, which is always visible.
 */
export function RunScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, sendAnswer, stop, restart, exportPdf, exporting } = useRun();

  const [themeId, setThemeId] = useState<ThemePresetId>('start-saudi');
  const [themeBusy, setThemeBusy] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void api
      .get(id)
      .then((s) => !cancelled && setThemeId(s.themeId))
      .catch(() => {
        /* A session the backend does not know about yet. The house preset is
           the right default and the picker still works. */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const changeTheme = async (next: ThemePresetId) => {
    if (!id) return;
    const previous = themeId;
    setThemeId(next); // optimistic: the picker should not lag the click
    setThemeBusy(true);
    try {
      await api.setTheme(id, next);
    } catch {
      setThemeId(previous);
    } finally {
      setThemeBusy(false);
    }
  };

  const live = !state.finished && !state.stopped;
  const notResponding = live && state.heartbeat?.alive === false;

  return (
    <AppShell
      mode={state.mode}
      breadcrumb={
        <span className="truncate text-sm text-ink-muted">
          {state.rfp?.client?.name ?? 'Proposal'}
        </span>
      }
      right={
        <div className="flex flex-wrap items-center gap-2">
          {/* The heartbeat is the authority on liveness. Without this, a run
              whose heartbeat has reported `alive: false` shows "Working…" here
              and "The agent is not responding" three centimetres below it. */}
          {notResponding ? (
            <StatusPill kind="error" text="Not responding" />
          ) : (
            <StatusPill kind={state.statusKind} text={state.statusText} />
          )}

          {/* Theme presets, switchable mid-run. */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Palette aria-hidden="true" />
                Theme
              </Button>
            </SheetTrigger>
            <SheetContent
              title="Document theme"
              description="Applies to the proposal, not to this screen."
            >
              <div className="scroll-thin flex-1 overflow-y-auto p-6">
                <ThemePresetPicker value={themeId} onChange={changeTheme} busy={themeBusy} hideLegend />
              </div>
            </SheetContent>
          </Sheet>

          {/* The activity log, on demand. */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <ListTree aria-hidden="true" />
                Activity
                {state.log.length ? (
                  <span className="tabular-nums text-ink-muted">{state.log.length}</span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent
              title="What the agent is doing"
              description="Every tool call, section and finding, in order."
              className="max-w-[40rem]"
            >
              {/* One scroller, and it belongs to the log. The two reference
                  panels above it collapse and bound their own height, so the
                  drawer never ends up with nested scroll areas fighting over
                  the wheel. */}
              <div className="flex min-h-0 flex-1 flex-col">
                <RfpFacts state={state} />
                <Outline state={state} />
                <ActivityLog rows={state.log} className="min-h-0 flex-1 py-2" />
              </div>
            </SheetContent>
          </Sheet>

          {live ? (
            <Button variant="destructive" size="sm" onClick={() => void stop()}>
              <Square aria-hidden="true" />
              Stop
            </Button>
          ) : null}

          {confirmRestart ? (
            <span className="flex items-center gap-2 text-xs text-ink-muted">
              Discard everything and start over?
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setConfirmRestart(false);
                  void restart().then(() => navigate('/'));
                }}
              >
                Restart
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRestart(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmRestart(true)}>
              <RotateCcw aria-hidden="true" />
              Restart
            </Button>
          )}
        </div>
      }
    >
      {/* The status band. Always visible, on both columns. */}
      <div className="px-6 pt-6">
        <AgentStatus state={state} />
      </div>

      {/* Two columns. They stack below lg, conversation first. */}
      <div className="grid gap-6 p-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(22rem,2fr)_3fr]">
        <section
          className="flex min-h-[26rem] flex-col overflow-hidden rounded-lg bg-surface ring-1 ring-hairline shadow-sm lg:min-h-0"
          aria-label="Conversation"
        >
          <div className="border-b border-hairline px-6 py-3">
            <PanelHeading>Conversation</PanelHeading>
          </div>
          <Conversation
            className="flex-1"
            messages={state.chat}
            placeholder={state.answerPlaceholder}
            waiting={state.waitingForAnswer}
            disabled={state.stopped}
            onSend={(text) => void sendAnswer(text)}
          />
        </section>

        <DocumentPanel
          className="min-h-[26rem] overflow-hidden rounded-lg ring-1 ring-hairline shadow-sm lg:min-h-0"
          state={state}
          exporting={exporting}
          onExport={() => {
            void exportPdf().then((url) => {
              if (url) window.open(url, '_blank', 'noopener');
            });
          }}
        />
      </div>
    </AppShell>
  );
}

const TONE: Record<StatusKind, 'neutral' | 'working' | 'waiting' | 'done' | 'stopped' | 'error'> = {
  idle: 'neutral',
  working: 'working',
  waiting: 'waiting',
  ready: 'done',
  stopped: 'stopped',
  error: 'error',
};

/**
 * The run's status, announced when it changes. `aria-live="polite"` rather
 * than assertive: the operator should hear "waiting for your answer" at the
 * end of the current sentence, not through the middle of it.
 */
function StatusPill({ kind, text }: { kind: StatusKind; text: string }) {
  return (
    <Badge tone={TONE[kind]} role="status" aria-live="polite">
      {text}
    </Badge>
  );
}
