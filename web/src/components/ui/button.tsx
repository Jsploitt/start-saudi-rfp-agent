import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * `bg-accent text-surface` is the one idiom worth reading twice.
 *
 * --ss-accent is --ss-green-deep on a light surface and --ss-green on a navy
 * one; --ss-bg is white on light and navy on dark. Pairing them means the
 * label is always the page's own background colour sitting on the register's
 * own accent — white on #004D43 (9.8:1) on light, navy on #27EAA6 (11.2:1) on
 * dark. It is never white on #27EAA6, which is 1.57:1 and unreadable, and the
 * component needs no knowledge of which surface it landed on.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ' +
    'transition-[filter,background-color,box-shadow] disabled:pointer-events-none disabled:opacity-40 ' +
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-surface hover:brightness-110 shadow-sm',
        secondary: 'bg-surface-raised text-ink ring-1 ring-inset ring-hairline hover:brightness-95',
        outline: 'bg-transparent text-ink ring-1 ring-inset ring-hairline hover:bg-surface-raised',
        ghost: 'bg-transparent text-ink-muted hover:bg-surface-raised hover:text-ink',
        /**
         * Deliberately not a red fill. --ss-danger is flagged in tokens.css as
         * a placeholder with no source in the identity, and white on it is
         * 3.55:1 — under AA for a 14px label. The red is carried by the edge,
         * which has no contrast requirement, and the text stays ink.
         */
        destructive: 'bg-transparent text-ink ring-1 ring-inset ring-[color:var(--ss-danger)] hover:tint-danger',
        link: 'bg-transparent text-accent underline underline-offset-4 hover:brightness-110',
      },
      size: {
        default: 'h-9 px-4 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
