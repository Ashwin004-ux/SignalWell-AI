import { forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-[#245b49] text-white shadow-sm shadow-[#245b49]/15 hover:-translate-y-0.5 hover:bg-[#1d4a3b] hover:shadow-md disabled:translate-y-0 disabled:bg-slate-300",
  secondary:
    "border border-slate-300 bg-white text-ink shadow-sm hover:border-slate-400 hover:bg-slate-50 disabled:text-slate-300 disabled:border-slate-200",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-ink"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4b8b70] focus-visible:ring-offset-2 disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
