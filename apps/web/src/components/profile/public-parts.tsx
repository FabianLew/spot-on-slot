import { Panel } from "@spot-on-slot/ui";

type Photo = { id: string; small: string; large: string };

/** Gallery of a public profile: thumbnails that open the large variant. Server- and client-safe (no hooks). */
export function PhotoGalleryView({
  title,
  photos,
  alt,
}: {
  title: string;
  photos: Photo[];
  alt: (index: number, total: number) => string;
}) {
  if (photos.length === 0) return null;
  return (
    <Panel title={title} headingLevel={3}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <a
              href={photo.large}
              target="_blank"
              rel="noopener noreferrer"
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- public WebP variant from the media module */}
              <img
                src={photo.small}
                alt={alt(index + 1, photos.length)}
                loading="lazy"
                className="aspect-square w-full border-2 border-border object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Outside links of a public profile; `nofollow`, since users add them. */
export function ExternalLinks({
  title,
  links,
}: {
  title: string;
  links: { key: string; href: string; label: string }[];
}) {
  if (links.length === 0) return null;
  return (
    <Panel title={title} headingLevel={3}>
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.key}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex border-2 border-border px-3 py-1.5 text-xs font-bold uppercase hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
