import { cn } from "@spot-on-slot/ui";
import type { Conversation } from "./queries";

/** The other side's small photo, or its initial on a dark tile. */
export function PartyPhoto({ conversation, className }: { conversation: Conversation; className?: string }) {
  const { name, photoUrl } = conversation.other;
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module
    <img
      src={photoUrl}
      alt=""
      width={40}
      height={40}
      className={cn("size-10 shrink-0 border-2 border-border object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center border-2 border-border bg-heading font-display text-base text-highlight dark:bg-background",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
