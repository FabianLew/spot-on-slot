"use client";

import { toApiProblem, unwrap } from "@spot-on-slot/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Button,
  Label,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@spot-on-slot/ui";
import { ApiErrorState } from "@/components/errors/api-error-state";
import { useArtistProfile, useMyVenues } from "@/components/onboarding/queries";
import { useSession } from "@/components/session/session-provider";
import { api } from "@/lib/api";
import { MAX_LENGTH, MESSAGES, type Conversation } from "./queries";

/** Who the first message goes to: an artist (written by a venue) or a venue (written by an artist). */
export type MessageRecipient = { artist: string } | { venue: string };

/** Enough to find an existing conversation: nobody starts that many direct ones (20 a day at most). */
const LOOKUP_SIZE = 100;

/** `/messages/new`: the first message to an artist or a venue; an existing conversation opens instead. */
export function NewMessageScreen({ recipient }: { recipient: MessageRecipient | null }) {
  const t = useTranslations("messages.new");
  const { session } = useSession();
  const role = session.status === "authenticated" ? session.user.role : "";

  let body;
  if (recipient == null) body = <Note text={t("notFound")} />;
  else if ("artist" in recipient && role !== "VENUE") body = <Note text={t("venuesOnly")} />;
  else if ("venue" in recipient && role !== "ARTIST") body = <Note text={t("artistsOnly")} />;
  else if ("artist" in recipient) body = <VenueWrites slug={recipient.artist} />;
  else body = <ArtistWrites slug={recipient.venue} />;

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />
      {body}
    </section>
  );
}

function Note({ text, href, link }: { text: string; href?: string; link?: string }) {
  return (
    <Panel>
      <p className="text-sm">{text}</p>
      {href && link && (
        <Button asChild variant="outline" className="self-start">
          <Link href={href}>{link}</Link>
        </Button>
      )}
    </Panel>
  );
}

/** The public name of the recipient, or null when there is no published profile at that address. */
function useRecipientName(kind: "artist" | "venue", slug: string) {
  return useQuery({
    queryKey: [...MESSAGES, "recipient", kind, slug],
    queryFn: async (): Promise<string | null> => {
      if (kind === "artist") {
        const result = await api.GET("/api/v1/public/artists/{slug}", { params: { path: { slug } } });
        if (result.response.status === 404 || result.response.status === 400) return null;
        return unwrap(result).stageName;
      }
      const result = await api.GET("/api/v1/public/venues/{slug}", { params: { path: { slug } } });
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result).name;
    },
  });
}

/** The direct conversation with `slug` (of the venue `venueId` when a venue writes), if there is one. */
function useExisting(slug: string, venueId: string | undefined, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [...MESSAGES, "existing", slug, venueId ?? "artist"],
    queryFn: async (): Promise<Conversation | null> => {
      const page = unwrap(
        await api.GET("/api/v1/conversations", { params: { query: { venueId, size: LOOKUP_SIZE } } }),
      );
      return (page.content ?? []).find((item) => item.kind === "DIRECT" && item.other.slug === slug) ?? null;
    },
  });
}

function VenueWrites({ slug }: { slug: string }) {
  const t = useTranslations("messages.new");
  const venues = useMyVenues();
  const name = useRecipientName("artist", slug);
  const [chosen, setChosen] = useState<string>();
  const published = (venues.data ?? []).filter((venue) => venue.published);
  const venue = published.find((item) => item.id === chosen) ?? published[0];

  if (venues.isPending || name.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (venues.isError) return <ApiErrorState error={venues.error} onRetry={() => venues.refetch()} />;
  if (name.isError) return <ApiErrorState error={name.error} onRetry={() => name.refetch()} />;
  if (name.data === null) return <Note text={t("notFound")} />;
  if (venues.data.length === 0) return <Note text={t("noVenue")} href="/onboarding" link={t("goProfile")} />;
  if (!venue) {
    return <Note text={t("venueNotPublished")} href={`/profile?venue=${venues.data[0]!.id}`} link={t("goProfile")} />;
  }

  return (
    <MessageForm key={venue.id} name={name.data} slug={slug} venueId={venue.id}>
      {published.length > 1 ? (
        <div className="flex min-w-56 flex-col gap-2 self-start">
          <label htmlFor="message-venue" className="text-sm font-bold uppercase">
            {t("venue")}
          </label>
          <Select value={venue.id} onValueChange={setChosen}>
            <SelectTrigger id="message-venue" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {published.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("from", { name: venue.name })}</p>
      )}
    </MessageForm>
  );
}

function ArtistWrites({ slug }: { slug: string }) {
  const t = useTranslations("messages.new");
  const profile = useArtistProfile();
  const name = useRecipientName("venue", slug);

  if (profile.isPending || name.isPending) return <Panel aria-busy="true" className="h-40" />;
  if (profile.isError) return <ApiErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  if (name.isError) return <ApiErrorState error={name.error} onRetry={() => name.refetch()} />;
  if (name.data === null) return <Note text={t("notFound")} />;
  if (!profile.data?.published) return <Note text={t("artistNotPublished")} href="/profile" link={t("goProfile")} />;
  return <MessageForm name={name.data} slug={slug} />;
}

/** The first message; the conversation opens after sending, or at once when it already exists. */
function MessageForm({
  name,
  slug,
  venueId,
  children,
}: {
  name: string;
  slug: string;
  venueId?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("messages.new");
  const router = useRouter();
  const queryClient = useQueryClient();
  const existing = useExisting(slug, venueId, true);
  const [text, setText] = useState("");
  const [clientId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing.data) router.replace(`/messages/${existing.data.id}`);
  }, [existing.data, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const conversation = unwrap(
        await api.POST("/api/v1/conversations", {
          body: venueId ? { venueId, artistSlug: slug, body, clientId } : { venueSlug: slug, body, clientId },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: MESSAGES });
      router.push(`/messages/${conversation.id}`);
    } catch (failure) {
      const problem = toApiProblem(failure);
      setError(problem.detail || problem.title || t("failed"));
      setBusy(false);
    }
  }

  if (existing.isPending || existing.data) return <Panel aria-busy="true" className="h-40" />;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Panel>
        <p className="font-display text-xl leading-tight">{t("to", { name })}</p>
        {children}
        <div className="flex flex-col gap-2">
          <Label htmlFor="first-message">{t("field")}</Label>
          <Textarea
            id="first-message"
            rows={5}
            value={text}
            maxLength={MAX_LENGTH}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("placeholder")}
            className="rounded-none border-2"
          />
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
        <Button type="submit" className="self-start" disabled={busy || text.trim().length === 0}>
          {t("send")}
        </Button>
      </Panel>
    </form>
  );
}
