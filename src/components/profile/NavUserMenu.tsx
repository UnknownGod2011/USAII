"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { clearStoredUser } from "@/lib/auth-session";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useEffect, useRef, useState } from "react";

export function NavUserMenu() {
  const router = useRouter();
  const { displayName, avatarUrl } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearStoredUser();
    window.dispatchEvent(new Event("launchpilot-auth-change"));
    router.push("/login");
  }

  return (
    <>
      <div ref={menuRef} className="relative ml-2">
        <button
          type="button"
          className="flex items-center gap-2"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="hidden text-white sm:inline">{displayName}</span>
          <UserAvatar name={displayName} avatarUrl={avatarUrl} size="sm" />
        </button>

        {open && (
          <div className="nav-dropdown" role="menu">
            <button
              type="button"
              className="nav-dropdown-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setEditOpen(true);
              }}
            >
              Edit profile
            </button>
            <Link href="/dashboard" className="nav-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
              Workspace
            </Link>
            <Link href="/settings" className="nav-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
              Privacy
            </Link>
            <div className="nav-dropdown-divider" />
            <button type="button" className="nav-dropdown-item" role="menuitem" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialDisplayName={displayName}
        initialAvatarUrl={avatarUrl}
      />
    </>
  );
}
