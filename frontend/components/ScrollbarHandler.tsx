"use client";

import { useEffect } from "react";

export default function ScrollbarHandler() {
  useEffect(() => {
    const scrollTimeouts = new Map<HTMLElement, NodeJS.Timeout>();

    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement;
      if (!target || !target.classList) return;

      // Add the scrolling class
      target.classList.add("is-scrolling");

      // Clear existing timeout for this element
      const existingTimeout = scrollTimeouts.get(target);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set timeout to remove the class
      const timeout = setTimeout(() => {
        target.classList.remove("is-scrolling");
        scrollTimeouts.delete(target);
      }, 1000);

      scrollTimeouts.set(target, timeout);
    };

    // Capture phase listener to catch scrolls on any element
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      for (const timeout of scrollTimeouts.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return null;
}
