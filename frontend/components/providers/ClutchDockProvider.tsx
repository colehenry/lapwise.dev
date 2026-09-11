"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RememberedThread } from "@/lib/clutch/dockMemory";
import type { ClutchHandoff } from "@/lib/clutch/handoff";

type DockState = {
  /** The thread on this page: a hand-off, or one remembered from a visit. */
  handoff: ClutchHandoff | null;
  expanded: boolean;
  handOff: (handoff: Omit<ClutchHandoff, "seq">) => void;
  /** Show a page's remembered thread, folded, with nothing to send. */
  resume: (thread: RememberedThread, route: string) => void;
  /** This page has no thread: no head. */
  dismiss: () => void;
  expand: () => void;
  collapse: () => void;
};

const DockContext = createContext<DockState | null>(null);

/**
 * Where the dock's thread lives. Mounted once in the shell so a hand-off from
 * any corner reaches the same bottom-right panel, and the panel survives
 * route changes.
 */
export default function ClutchDockProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [handoff, setHandoff] = useState<ClutchHandoff | null>(null);
  const [expanded, setExpanded] = useState(false);
  const seq = useRef(0);

  const handOff = useCallback((next: Omit<ClutchHandoff, "seq">) => {
    seq.current += 1;
    setHandoff({ ...next, seq: seq.current });
    setExpanded(true);
  }, []);
  const resume = useCallback((thread: RememberedThread, route: string) => {
    seq.current += 1;
    setHandoff({
      seq: seq.current,
      trail: [],
      title: thread.title,
      pageContext: { route },
    });
    setExpanded(false);
  }, []);
  const dismiss = useCallback(() => {
    setHandoff(null);
    setExpanded(false);
  }, []);
  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  const value = useMemo(
    () => ({ handoff, expanded, handOff, resume, dismiss, expand, collapse }),
    [handoff, expanded, handOff, resume, dismiss, expand, collapse],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useClutchDock(): DockState {
  const dock = useContext(DockContext);
  if (!dock) throw new Error("useClutchDock needs a ClutchDockProvider");
  return dock;
}
