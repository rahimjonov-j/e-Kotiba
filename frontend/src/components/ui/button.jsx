import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-card hover:bg-muted",
  ghost: "hover:bg-muted",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({ className, variant = "default", asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}