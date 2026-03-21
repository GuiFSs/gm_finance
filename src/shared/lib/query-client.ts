"use client";

import { QueryClient } from "@tanstack/react-query";

import { QUERY_STALE_TIME_MS } from "@/shared/lib/constants";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
}
