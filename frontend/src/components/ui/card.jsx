import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn("rounded-xl bg-card p-4 shadow-soft", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("mt-3", className)} {...props} />;
}