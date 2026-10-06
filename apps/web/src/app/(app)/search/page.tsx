import { Suspense } from "react";
import { navMetadata } from "@/lib/nav-metadata";
import { SearchScreen } from "@/components/search/search-screen";

export default function Page() {
  // The screen reads its filters from the address on the client.
  return (
    <Suspense>
      <SearchScreen />
    </Suspense>
  );
}

export const generateMetadata = () => navMetadata("search");
