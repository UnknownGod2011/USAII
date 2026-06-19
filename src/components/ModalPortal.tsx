"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ModalPortalProps = {
  children: React.ReactNode;
};

export function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
