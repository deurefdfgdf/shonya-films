import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-[var(--color-border)] bg-[rgb(255_244_227_/_0.06)] text-[var(--color-text)]',
        secondary:
          'border-[var(--color-border)] bg-[rgb(255_244_227_/_0.03)] text-[var(--color-text-secondary)]',
        destructive:
          'border-[rgb(156_127_116_/_0.25)] bg-[rgb(156_127_116_/_0.12)] text-[var(--color-danger)]',
        outline: 'border-[var(--color-border)] text-[var(--color-text-secondary)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
