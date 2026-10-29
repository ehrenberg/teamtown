import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes } from 'react';
import { classNames } from './class-names.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-action-primary text-white hover:bg-action-primary-hover',
  secondary: 'bg-action-secondary text-text-primary hover:bg-neutral-200',
  ghost: 'bg-transparent text-text-primary hover:bg-neutral-100',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  /** Renders the child element (e.g. a link) with button styling instead of a <button>. */
  readonly asChild?: boolean;
}

export function Button({ variant = 'primary', asChild = false, className, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      type={asChild ? undefined : (type ?? 'button')}
      className={classNames(
        'inline-flex min-h-6 items-center justify-center gap-2 rounded-md px-4 py-2 font-body text-sm font-semibold transition-colors disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
