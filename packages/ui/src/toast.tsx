import { CircleAlert } from "lucide-react";
import type { ComponentProps } from "react";
import { Toaster as Sonner, toast } from "sonner";

export { toast };

export function Toaster({ ...props }: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      icons={{ error: <CircleAlert className="size-4" aria-hidden="true" /> }}
      toastOptions={{
        classNames: {
          toast: "bg-popover text-popover-foreground border border-border shadow-md",
          error: "!text-danger",
          success: "!text-success",
        },
      }}
      {...props}
    />
  );
}
