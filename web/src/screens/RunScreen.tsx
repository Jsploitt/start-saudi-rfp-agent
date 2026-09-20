import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListTree, Palette, RotateCcw, Square } from 'lucide-react';
import { useMode } from '@/App';
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
import { asPresetId, type StatusKind, type ThemePresetId } from '@/types';

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
  const mode = useMode();
  const navigate = useNavigate();
  const { state, detail, loadError, sendAnswer, stop, restart, exportPdf, exporting, setTheme } =
    useRun();

  const [themeId, setThemeId] = useState<ThemePresetId>('start-saudi');
  const [themeBusy, setThemeBusy] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  /* The stored preset, once the session endpoint answers. The server keeps it
     as a free-form string; anything this picker does not offer reads as the
     house style rather than as a blank selection. */
  useEffect(() => {
    if (detail) setThemeId(asPresetId(detail.theme.preset));
  }, [detail]);

  const changeTheme = async (next: ThemePresetId) => {
    const previous = themeId;
    setThemeId(next); // optimistic: the picker should not lag the click
    setThemeBusy(true);
    try {
      await setTheme(next);
    } catch {
      setThemeId(previous);
    } finally {
      setThemeBusy(false);
    }
  };

  if (loadError) {
    return (
      <AppShell mode={mode}>
        <div className="mx-auto w-full max-w-2xl px-6 py-12">
          <p className="tint-danger rounded-md px-4 py-3 text-sm text-ink" role="alert">
            {loadError}
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate('/')}>
            Back to the proposals
          </Button>
        </div>
      </AppShell>
    );
  }

  /* `orphaned` is a session whose agent died with a previous process. It is
     neither running nor finished, and showing a Stop button for it would offer
     to stop something that is already gone. */
  const live = !state.finished && !state.stopped && state.session !== 'orphaned';
  const notResponding = live && state.heartbeat?.alive === false;

  return (
    <AppShell
      mode={state.mode ?? mode}
      breadcrumb={
        <span className="truncate text-sm text-ink-muted">
          {state.rfp?.client?.name ?? detail?.title ?? 'Proposal'}
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
              {/* Not "discard everything": the server starts a NEW session over
                  the same RFP and leaves this one intact and readable. Saying
                  otherwise would talk an operator out of pressing a button
                  that costs them nothing. */}
              Run it again from the start? This one is kept.
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setConfirmRestart(false);
                  void restart().then((next) => {
                    if (next) navigate(`/s/${next}`);
                  });
                }}
              >
                Run again
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRestart(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmRestart(true)}>
              <RotateCcw aria-hidden="true" />
              Run again
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
          onExport={() => void exportPdf()}
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
