import { navMetadata } from "@/lib/nav-metadata";
import { MessagesScreen } from "@/components/messages/messages-screen";

export default async function Page({ params, searchParams }: PageProps<"/messages/[id]">) {
  const [{ id }, { venue }] = await Promise.all([params, searchParams]);
  return <MessagesScreen conversationId={id} venueId={typeof venue === "string" ? venue : undefined} />;
}

export const generateMetadata = () => navMetadata("messages");
