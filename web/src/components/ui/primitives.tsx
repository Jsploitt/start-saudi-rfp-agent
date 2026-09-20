import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ---- Card ---------------------------------------------------------------- */

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg bg-surface ring-1 ring-hairline shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 p-6', className)} {...p} />
);

export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('font-display text-lg font-semibold text-ink', className)} {...p} />
);

export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-ink-muted', className)} {...p} />
);

export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-6 pt-0', className)} {...p} />
);

export const CardFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-3 p-6 pt-0', className)} {...p} />
);

/* ---- Badge --------------------------------------------------------------- */

/**
 * Status colour is carried by a tinted background plus an ink label, never by
 * coloured text on a light field. `--ss-green` in particular is 1.57:1 on
 * white and can never carry a glyph there.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ' +
    'tracking-display uppercase tabular-nums',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-raised text-ink-muted ring-1 ring-inset ring-hairline',
        accent: 'tint-accent text-accent ring-1 ring-inset ring-hairline',
        working: 'bg-surface-raised text-ink ring-1 ring-inset ring-hairline',
        waiting: 'tint-caution text-ink ring-1 ring-inset ring-hairline',
        caution: 'tint-caution text-ink ring-1 ring-inset ring-hairline',
        done: 'tint-accent text-accent ring-1 ring-inset ring-hairline',
        stopped: 'tint-danger text-ink ring-1 ring-inset ring-hairline',
        error: 'tint-danger text-ink ring-1 ring-inset ring-hairline',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, tone, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props} />
);

/* ---- Form fields --------------------------------------------------------- */

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-xs font-semibold uppercase tracking-display text-ink-muted', className)}
    {...props}
  />
));
Label.displayName = 'Label';

const fieldBase =
  'w-full rounded-md bg-surface px-3 py-2 text-sm text-ink ring-1 ring-inset ring-hairline ' +
  'placeholder:text-ink-muted transition-shadow focus:ring-2 focus:ring-accent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-9', className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'resize-none', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/**
 * A native select, styled. Radix's Select is a better listbox but a worse
 * form control on a phone, and every select in this app is a plain one-of-N
 * choice inside a form.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, 'h-9 pr-8', className)} {...props} />
));
Select.displayName = 'Select';

/* ---- Field: label, control, hint, error, wired together ------------------ */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: htmlFor,
            'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
            'aria-invalid': error ? true : undefined,
            required,
          })
        : children}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-xs font-semibold text-ink">
          <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle bg-[color:var(--ss-danger)]" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ---- Separator ----------------------------------------------------------- */

export const Separator = ({ className, ...p }: React.HTMLAttributes<HTMLHRElement>) => (
  <hr className={cn('border-0 border-t border-hairline', className)} {...p} />
);

/* ---- Section heading ----------------------------------------------------- */

export const PanelHeading = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn(
      'text-xs font-semibold uppercase tracking-display text-ink-muted',
      className
    )}
    {...p}
  />
);
