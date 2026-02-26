import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-blue-500/30 bg-blue-500/10 text-blue-400",
        secondary:
          "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground-muted)]",
        success:
          "border-green-500/30 bg-green-500/10 text-green-400",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-400",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400",
        critical:
          "border-red-500/50 bg-red-500/20 text-red-300 font-semibold",
        outline:
          "border-[var(--border)] bg-transparent text-[var(--foreground-muted)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
