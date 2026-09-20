import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemePreset, ThemePresetId } from '@/types';

/**
 * Three fixed presets, and only three.
 *
 * The swatches below name tokens rather than values, so a preset cannot drift
 * from the brand file. A custom colour picker is a stretch goal, not a
 * commitment: it would need a contrast check against the document's own body
 * copy before it could be allowed to ship, and picking an arbitrary colour is
 * exactly how --ss-green ends up carrying text on white.
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'start-saudi',
    name: 'Start Saudi house',
    description: 'The brand as it is: navy slides, the green as the single accent.',
    swatch: ['--ss-navy', '--ss-green', '--ss-cream'],
  },
  {
    id: 'neutral-corporate',
    name: 'Neutral corporate',
    description: 'No brand colour in the document. For a client who will re-skin it themselves.',
    swatch: ['--ss-neutral-800', '--ss-neutral-500', '--ss-neutral-100'],
  },
  {
    id: 'client-accent',
    name: 'Client accent',
    description: 'Neutral ground, with the accent reserved for the client’s own mark.',
    swatch: ['--ss-navy', '--ss-green-deep', '--ss-neutral-50'],
  },
];

export function ThemePresetPicker({
  value,
  onChange,
  busy,
  className,
  hideLegend,
}: {
  value: ThemePresetId;
  onChange(id: ThemePresetId): void;
  busy?: boolean;
  className?: string;
  /** The drawer already has this as its title; do not say it twice. */
  hideLegend?: boolean;
}) {
  return (
    <fieldset className={cn('min-w-0', className)} disabled={busy}>
      <legend
        className={cn(
          hideLegend
            ? 'sr-only'
            : 'text-xs font-semibold uppercase tracking-display text-ink-muted'
        )}
      >
        Document theme
      </legend>
      <div className={cn('flex flex-col gap-2', !hideLegend && 'mt-3')}>
        {THEME_PRESETS.map((preset) => {
          const selected = preset.id === value;
          return (
            <label
              key={preset.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 ring-1 ring-inset',
                'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--ss-accent)]',
                selected ? 'tint-accent ring-[color:var(--ss-accent)]' : 'ring-hairline hover:bg-surface-raised',
                busy && 'opacity-60'
              )}
            >
              <input
                type="radio"
                name="theme-preset"
                className="sr-only"
                checked={selected}
                onChange={() => onChange(preset.id)}
              />
              <span aria-hidden="true" className="mt-0.5 flex shrink-0 gap-1">
                {preset.swatch.map((tokenName) => (
                  <span
                    key={tokenName}
                    className="size-4 rounded-sm ring-1 ring-inset ring-hairline"
                    style={{ background: `var(${tokenName})` }}
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  {preset.name}
                  {selected ? <Check className="size-3.5 text-accent" aria-hidden="true" /> : null}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">{preset.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
