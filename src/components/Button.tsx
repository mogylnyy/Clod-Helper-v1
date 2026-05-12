import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "bg-vb-emerald text-black hover:brightness-110 active:scale-[0.98] shadow-[0_4px_16px_rgba(16,185,129,0.25)]",
        variant === "secondary" &&
          "bg-vb-surface text-vb-silver border border-vb-border hover:border-vb-silver-dim",
        variant === "ghost" &&
          "text-vb-silver-dim hover:text-vb-silver hover:bg-vb-surface/60",
        className,
      )}
    >
      {children}
    </button>
  );
});
