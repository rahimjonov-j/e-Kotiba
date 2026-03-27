import { cn } from "../../lib/utils";

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}