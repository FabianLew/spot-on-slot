"use client";

import { unwrap } from "@spot-on-slot/api-client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

/** Suggestions from `GET /locations/search` for what is typed, debounced, for `LocationPicker`. */
export function usePlaceSearch() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useQuery({
    queryKey: ["location", "search", term],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/locations/search", {
          params: { query: { q: term } },
        }),
      ),
    enabled: term.length >= MIN_QUERY,
    staleTime: 60_000,
  });

  // Keep the previous list while the next one loads, but only for the term it belongs to.
  const suggestions = term.length >= MIN_QUERY && query.trim().length >= MIN_QUERY ? (search.data ?? []) : [];
  return {
    query,
    setQuery,
    suggestions,
    searching: query.trim() !== term || search.isFetching,
    error: search.error,
  };
}
