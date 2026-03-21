"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { fetcher } from "@/shared/lib/fetcher";

type UserOption = { id: string; name: string };
type SessionUser = { id: string; name: string };

export function useUsers() {
  return useQuery({
    queryKey: ["auth-users"],
    queryFn: () => fetcher<{ data: UserOption[] }>("/api/auth/users"),
    select: (response) => response.data,
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth-me"],
    queryFn: () => fetcher<{ data: SessionUser }>("/api/auth/me"),
    select: (response) => response.data,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (payload: { userId: string; pin: string }) =>
      fetcher<{ data: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () =>
      fetcher<{ data: { success: boolean } }>("/api/auth/logout", {
        method: "POST",
      }),
  });
}
