"use client";

import * as React from "react";
import type { Profile } from "@/lib/supabase/types";

const ProfileContext = React.createContext<Profile | null>(null);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): Profile {
  const ctx = React.useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}

export function useCurrency(): string {
  return useProfile().currency;
}
