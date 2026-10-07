import { navMetadata } from "@/lib/nav-metadata";
import { NewMessageScreen } from "@/components/messages/new-message-screen";

export default async function Page({ searchParams }: PageProps<"/messages/new">) {
  const { artist, venue } = await searchParams;
  const recipient = typeof artist === "string" ? { artist } : typeof venue === "string" ? { venue } : null;
  return <NewMessageScreen recipient={recipient} />;
}

export const generateMetadata = () => navMetadata("messages");
