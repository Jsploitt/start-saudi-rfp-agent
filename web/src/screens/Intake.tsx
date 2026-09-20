import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { sessions as api } from '@/api/client';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import type { IntakeDraft } from '@/types';

/**
 * Structured intake, replacing free-text guessing.
 *
 * Every field here lands somewhere specific in the document: the legal name
 * and the contact go on the cover and into the engagement letter's address
 * block, sector and country feed the about-the-client section, and the
 * client's own target date is what the agent works the schedule backwards
 * from. Asking for them once, in a form, is cheaper than the agent inferring
 * them from an RFP that may not state them — and an inferred legal name on a
 * cover page is the kind of error that reaches a client.
 *
 * Nothing is guessed on the client's behalf: a field left blank arrives as
 * blank, and the agent asks about it like any other gap.
 */

const SECTORS = [
  'Engineering and industrial',
  'Energy and utilities',
  'Construction and real estate',
  'Healthcare and life sciences',
  'Technology and software',
  'Financial services',
  'Logistics and transport',
  'Consumer and retail',
  'Professional services',
  'Other',
];

const EMPTY: IntakeDraft = {
  clientLegalName: '',
  sector: '',
  country: '',
  contactName: '',
  contactEmail: '',
  assignment: '',
  targetDate: '',
};

export function Intake({ mode }: { mode: string | null }) {
  const [draft, setDraft] = useState<IntakeDraft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeDraft, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const navigate = useNavigate();

  const set = <K extends keyof IntakeDraft>(key: K, value: IntakeDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof IntakeDraft, string>> = {};
    if (!draft.clientLegalName.trim()) next.clientLegalName = 'The cover page needs a legal name.';
    if (!draft.assignment.trim()) next.assignment = 'One line is enough.';
    if (draft.contactEmail && !draft.contactEmail.includes('@'))
      next.contactEmail = 'That does not look like an email address.';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      const created = await api.create(draft);
      navigate(`/s/${created.id}/upload`);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <AppShell mode={mode} breadcrumb={<span className="text-sm text-ink-muted">New proposal</span>}>
      <div className="scroll-thin mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Who is this for?</CardTitle>
            <CardDescription>
              These go straight onto the cover and into the about-the-client section. Leave
              anything you do not know blank and the agent will ask about it.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
              <Field
                label="Client legal name"
                htmlFor="clientLegalName"
                hint="Exactly as it appears on their registration, including the suffix."
                error={errors.clientLegalName ?? null}
                required
              >
                <Input
                  value={draft.clientLegalName}
                  onChange={(e) => set('clientLegalName', e.target.value)}
                  autoFocus
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Sector" htmlFor="sector">
                  <Select value={draft.sector} onChange={(e) => set('sector', e.target.value)}>
                    <option value="">Not stated</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Country" htmlFor="country" hint="Where the client is registered now.">
                  <Input
                    value={draft.country}
                    onChange={(e) => set('country', e.target.value)}
                    autoComplete="country-name"
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Contact name" htmlFor="contactName">
                  <Input
                    value={draft.contactName}
                    onChange={(e) => set('contactName', e.target.value)}
                    autoComplete="name"
                  />
                </Field>

                <Field
                  label="Contact email"
                  htmlFor="contactEmail"
                  error={errors.contactEmail ?? null}
                >
                  <Input
                    type="email"
                    value={draft.contactEmail}
                    onChange={(e) => set('contactEmail', e.target.value)}
                    autoComplete="email"
                  />
                </Field>
              </div>

              <Field
                label="The assignment, in one line"
                htmlFor="assignment"
                hint="What they are asking for. This becomes the subject line of the engagement letter."
                error={errors.assignment ?? null}
                required
              >
                <Textarea
                  rows={2}
                  value={draft.assignment}
                  onChange={(e) => set('assignment', e.target.value)}
                />
              </Field>

              <Field
                label="Client's target date"
                htmlFor="targetDate"
                hint="Their date, not ours. The schedule is worked backwards from it."
              >
                <Input
                  type="date"
                  value={draft.targetDate}
                  onChange={(e) => set('targetDate', e.target.value)}
                />
              </Field>

              {failure ? (
                <p role="alert" className="tint-danger rounded-md px-3 py-2 text-sm text-ink">
                  Could not create the proposal. {failure}
                </p>
              ) : null}

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" size="lg" disabled={busy}>
                  {busy ? 'Creating…' : 'Continue'}
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" onClick={() => navigate('/')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
