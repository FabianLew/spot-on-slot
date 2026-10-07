import { navMetadata } from "@/lib/nav-metadata";
import { MessagesScreen } from "@/components/messages/messages-screen";

export default async function Page({ searchParams }: PageProps<"/messages">) {
  const { venue } = await searchParams;
  return <MessagesScreen venueId={typeof venue === "string" ? venue : undefined} />;
}

export const generateMetadata = () => navMetadata("messages");
