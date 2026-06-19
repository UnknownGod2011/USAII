"use client";

import { Pencil, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

type ProjectNameEditorProps = {
  name: string;
  onSave: (name: string) => void;
};

export function ProjectNameEditor({ name, onSave }: ProjectNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(name);
  }, [name, editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    }
    setEditing(false);
    setDraft(trimmed || name);
  }

  function cancel() {
    setDraft(name);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="input-field max-w-xl text-2xl font-semibold"
        />
        <button type="button" onClick={commit} className="btn-secondary px-3 py-2" aria-label="Save name">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={cancel} className="btn-secondary px-3 py-2" aria-label="Cancel edit">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{name}</h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="btn-secondary px-3 py-2"
        aria-label="Edit project name"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}
