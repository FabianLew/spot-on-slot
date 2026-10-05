import { PixelHeadphones, PixelPin, Tag, cn } from "@spot-on-slot/ui";
import { sampleDj } from "./sample-data";

/** Pixel avatar box: dark in both themes, as in the mockups. */
export function DjAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center border-2 border-border bg-heading dark:bg-background",
        className,
      )}
    >
      <PixelHeadphones className="w-3/5 text-highlight" />
    </div>
  );
}

export function GenreTags({ genres }: { genres: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {genres.map((genre) => (
        <li key={genre}>
          <Tag>{genre}</Tag>
        </li>
      ))}
    </ul>
  );
}

export function CityLine({ city, extra }: { city: string; extra?: string }) {
  return (
    <p className="flex items-start gap-2 text-xs uppercase">
      <PixelPin className="mt-px size-3.5 shrink-0 text-primary dark:text-highlight" />
      <span className="flex flex-col gap-1">
        <span>{city}</span>
        {extra && <span>{extra}</span>}
      </span>
    </p>
  );
}

export const djName = sampleDj.name;
