import { cn } from "../../lib/utils";

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    />
  );
}