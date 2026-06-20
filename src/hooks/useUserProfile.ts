"use client";

import { getCurrentUserId, getStoredUser, getUserEmail, getUserLabel } from "@/lib/auth-session";
import { getUserProfile } from "@/lib/users/firestore";
import { PROFILE_CHANGE_EVENT } from "@/lib/users/profileEvents";
import type { FounderUserProfile } from "@/lib/users/types";
import { useCallback, useEffect, useState } from "react";

export function useUserProfile() {
  const [profile, setProfile] = useState<FounderUserProfile | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setProfile(null);
      setReady(true);
      return;
    }

    try {
      setProfile(await getUserProfile(userId));
    } catch {
      setProfile(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    function onProfileChange(event: Event) {
      const detail = (event as CustomEvent<Partial<FounderUserProfile>>).detail;
      if (detail) {
        setProfile((current) => ({ background: "", skills: "", goals: "", ...current, ...detail }));
      }
      void refresh();
    }

    window.addEventListener(PROFILE_CHANGE_EVENT, onProfileChange);
    return () => window.removeEventListener(PROFILE_CHANGE_EVENT, onProfileChange);
  }, [refresh]);

  const user = getStoredUser();
  const fallbackName = user ? getUserLabel(user) : "Founder";
  const displayName = profile?.displayName?.trim() || fallbackName;
  const email = user ? getUserEmail(user) : "";

  return {
    profile,
    ready,
    refresh,
    displayName,
    avatarUrl: profile?.avatarUrl || user?.avatarUrl || null,
    email,
  };
}
