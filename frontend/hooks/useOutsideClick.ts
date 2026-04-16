"use client";

import { useEffect, useRef } from "react";

export function useOutsideClick<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onOutside]);

  return ref;
}
