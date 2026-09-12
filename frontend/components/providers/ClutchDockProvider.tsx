"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AnalysisPageContext } from "@/lib/ai/analysis-contracts";
import type { RememberedThread } from "@/lib/clutch/dockMemory";
import type { ClutchHandoff } from "@/lib/clutch/handoff";
import type { Surface } from "@/lib/clutch/script";

/**
 * What the page has told Clutch to answer for from the corner. Typed where
 * it is registered; `never` here because the context's shape belongs to its
 * surface and the dock only passes the pair back to a corner together.
 */
export type PageSurface = {
  surface: Surface<never>;
  context: never;
  title: string;
  pageContext: AnalysisPageContext;
};

type DockState = {
  /** The thread on this page: a hand-off, or one remembered from a visit. */
  handoff: ClutchHandoff | null;
  /** The page's own corner, answered from the head in the page corner. */
  pageSurface: PageSurface | null;
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
/* Registration is its own context so a page that registers a surface does
   not re-render with the dock's state. */
const RegistryContext = createContext<
  ((surface: PageSurface | null) => void) | null
>(null);

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
  const [pageSurface, setPageSurface] = useState<PageSurface | null>(null);
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
    () => ({
      handoff,
      pageSurface,
      expanded,
      handOff,
      resume,
      dismiss,
      expand,
      collapse,
    }),
    [
      handoff,
      pageSurface,
      expanded,
      handOff,
      resume,
      dismiss,
      expand,
      collapse,
    ],
  );

  return (
    <RegistryContext.Provider value={setPageSurface}>
      <DockContext.Provider value={value}>{children}</DockContext.Provider>
    </RegistryContext.Provider>
  );
}

/**
 * The page's corner: the head in the page corner answers this surface until
 * the page unmounts or registers another. Null context or page context —
 * the page still loading — registers nothing. `context` and `pageContext`
 * are effect dependencies, so the caller keeps them referentially stable.
 */
export function usePageSurface<C>(
  surface: Surface<C>,
  context: C | null,
  title: string,
  pageContext: AnalysisPageContext | null,
): void {
  const register = useContext(RegistryContext);
  if (!register) throw new Error("usePageSurface needs a ClutchDockProvider");
  useEffect(() => {
    if (context === null || pageContext === null) return;
    register({
      surface: surface as Surface<never>,
      context: context as never,
      title,
      pageContext,
    });
    return () => register(null);
  }, [register, surface, context, title, pageContext]);
}

export function useClutchDock(): DockState {
  const dock = useContext(DockContext);
  if (!dock) throw new Error("useClutchDock needs a ClutchDockProvider");
  return dock;
}
