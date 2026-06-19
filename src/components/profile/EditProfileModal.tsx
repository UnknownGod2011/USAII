"use client";

import { ModalPortal } from "@/components/ModalPortal";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { AvatarCropModal } from "@/components/profile/AvatarCropModal";
import {
  getCurrentUserId,
  getStoredUser,
  getUserEmail,
  getUserLabel,
  updateStoredUserName,
} from "@/lib/auth-session";
import { saveUserIdentity } from "@/lib/users/firestore";
import { dispatchProfileChange } from "@/lib/users/profileEvents";
import { useEffect, useRef, useState } from "react";

type EditProfileModalProps = {
  open: boolean;
  onClose: () => void;
  initialDisplayName?: string;
  initialAvatarUrl?: string | null;
  onSaved?: (displayName: string, avatarUrl?: string | null) => void;
};

export function EditProfileModal({
  open,
  onClose,
  initialDisplayName,
  initialAvatarUrl,
  onSaved,
}: EditProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const user = getStoredUser();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayName(initialDisplayName?.trim() || (user ? getUserLabel(user) : "Founder"));
    setAvatarUrl(initialAvatarUrl ?? null);
    setError(null);
  }, [open, initialDisplayName, initialAvatarUrl]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, saving, onClose]);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleCropSave(dataUrl: string) {
    setAvatarUrl(dataUrl);
    setCropOpen(false);
    setCropSrc(null);
  }

  async function handleSave() {
    const userId = getCurrentUserId();
    const user = getStoredUser();
    if (!userId || !user) return;

    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Display name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = await saveUserIdentity(userId, {
        displayName: trimmed,
        avatarUrl: avatarUrl ?? undefined,
        email: getUserEmail(user),
      });

      updateStoredUserName(trimmed);
      dispatchProfileChange({
        displayName: saved.displayName,
        avatarUrl: saved.avatarUrl,
      });

      onSaved?.(saved.displayName ?? trimmed, saved.avatarUrl);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <ModalPortal>
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => {
            if (!saving) onClose();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="terminal-card modal-panel w-full max-w-md p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="edit-profile-title" className="mono-label">
              Edit profile
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Your identity</h2>

            <div className="mt-6 flex flex-col items-center gap-3">
              <UserAvatar
                name={displayName}
                avatarUrl={avatarUrl}
                onClick={() => fileInputRef.current?.click()}
              />
              <button
                type="button"
                className="font-mono text-xs uppercase tracking-wider text-lp-subtle hover:text-white"
                onClick={() => fileInputRef.current?.click()}
              >
                Change photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="mt-6">
              <label htmlFor="display-name" className="profile-field-label mb-2 block">
                Display name
              </label>
              <input
                id="display-name"
                className="input-field"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
              />
            </div>

            {error && <p className="mt-4 font-mono text-xs text-red-400">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          open={cropOpen}
          saving={false}
          onCancel={() => {
            if (!saving) {
              setCropOpen(false);
              setCropSrc(null);
            }
          }}
          onSave={handleCropSave}
        />
      )}
    </>
  );
}
