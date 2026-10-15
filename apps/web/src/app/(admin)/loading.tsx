import { Skeleton } from "@spot-on-slot/ui";

export default function Loading() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
