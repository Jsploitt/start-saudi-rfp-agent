/**
 * Reading a session back from the database.
 *
 * A rehydrated Run is read-only in practice: its sections and its outline are
 * restored so the document can be listed, re-rendered and exported, but no agent
 * is attached to it and no subprocess is coming back. Constructing one touches
 * no disk, which is why the directory is created explicitly rather than in the
 * constructor.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Run, registerRun, getRun, RfpAnalysis, Brief, type OutlineItem } from '../run.js';
import * as store from '../db/store.js';
import { sessionDir } from './artifacts.js';
import type { SessionRow, SessionSummary } from './types.js';
import type { Intake } from '../contracts.js';

/** Stored as JSON in one column. A malformed value is treated as no intake. */
function readIntake(raw: string | null): Intake | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Intake) : null;
  } catch {
    return null;
  }
}

/** Outline order is the one thing that lives in the artifact rather than a table. */
function readOutline(id: string): OutlineItem[] {
  try {
    const raw = readFileSync(join(sessionDir(id), 'sections.json'), 'utf8');
    const parsed = JSON.parse(raw) as { outline?: OutlineItem[] };
    return Array.isArray(parsed.outline) ? parsed.outline : [];
  } catch {
    return [];
  }
}

export function rehydrate(row: SessionRow): Run {
  const existing = getRun(row.id);
  if (existing) return existing;

  const run = new Run({
    id: row.id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    rfpPath: row.rfpPath,
    rfpName: row.rfpName,
    restartedFrom: row.restartedFrom,
    userId: row.userId,
    intake: readIntake(row.intake),
    startSeq: store.nextSeq(row.id),
    startedAt: row.createdAt,
    finishedAt: row.finishedAt,
  });
  run.phase = row.phase;
  run.theme = { preset: row.themePreset, accent: row.themeAccent };
  run.outline = readOutline(row.id);
  run.loadSections(store.listSections(row.id));

  /* The analysis and the brief live in the event log rather than a table. They
     are restored because the document's own title is derived from them: without
     this, re-rendering a past session quietly retitles it. */
  const rfp = store.latestEvent(row.id, 'rfp');
  if (rfp && 'analysis' in rfp) {
    const parsed = RfpAnalysis.safeParse(rfp.analysis);
    if (parsed.success) run.rfp = parsed.data;
  }
  const brief = store.latestEvent(row.id, 'brief');
  if (brief && 'brief' in brief) {
    const parsed = Brief.safeParse(brief.brief);
    if (parsed.success) run.brief = parsed.data;
  }

  return registerRun(run);
}

/** The listing shape. Live runs answer from memory, the rest from the tables. */
export function summarise(row: SessionRow, sectionCount: number): SessionSummary {
  const live = getRun(row.id);
  return {
    id: row.id,
    title: row.title,
    status: live?.status ?? row.status,
    phase: live?.phase ?? row.phase,
    mode: row.mode,
    rfpName: row.rfpName,
    sections: live?.sectionCount() ?? sectionCount,
    live: Boolean(live?.running),
    restartedFrom: row.restartedFrom,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
    archivedAt: row.archivedAt,
  };
}
