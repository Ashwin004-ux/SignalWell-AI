import clsx from "clsx";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(20,45,35,0.035)] transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(20,45,35,0.07)] sm:p-6", className)}
      {...props}
    />
  );
}

export function CardHeading({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx("text-sm font-semibold tracking-[-0.01em] text-slate-700", className)}
      {...props}
    />
  );
}
