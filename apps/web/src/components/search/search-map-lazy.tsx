"use client";

import dynamic from "next/dynamic";

/** MapLibre is large and needs the browser, so it loads only on the search screen and never on the server. */
export const SearchMap = dynamic(() => import("./search-map").then((module) => module.SearchMap), {
  ssr: false,
  loading: () => <div aria-busy="true" className="size-full min-h-80 animate-pulse bg-muted" />,
});
