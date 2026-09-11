/**
 * What the dock remembers between visits, per reader, in this browser: which
 * conversation belongs to which page, and how wide the panel was left. The
 * conversations themselves live on the server; this is only the index.
 */

const THREADS_KEY = "lapwise-clutch-threads";
const WIDTH_KEY = "lapwise-clutch-dock-width";

export const DOCK_MIN_WIDTH = 360;
export const DOCK_MAX_WIDTH = 720;

export type RememberedThread = { conversationId: string; title: string };

type ThreadIndex = Record<string, RememberedThread>;

/** A route without its query, so every tab of a page shares one thread. */
export function threadRoute(route: string): string {
  return route.split("?")[0];
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Private mode or a full store: the dock still works, it just forgets. */
  }
}

function threadIndex(userId: number): ThreadIndex {
  const raw = read(`${THREADS_KEY}:${userId}`);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ThreadIndex) : {};
  } catch {
    return {};
  }
}

export function rememberThread(
  userId: number,
  route: string,
  thread: RememberedThread,
) {
  const index = threadIndex(userId);
  index[threadRoute(route)] = thread;
  write(`${THREADS_KEY}:${userId}`, JSON.stringify(index));
}

export function threadFor(
  userId: number,
  route: string,
): RememberedThread | null {
  return threadIndex(userId)[threadRoute(route)] ?? null;
}

export function forgetThread(userId: number, route: string) {
  const index = threadIndex(userId);
  delete index[threadRoute(route)];
  write(`${THREADS_KEY}:${userId}`, JSON.stringify(index));
}

export function clampDockWidth(width: number, viewport: number): number {
  const max = Math.min(DOCK_MAX_WIDTH, Math.floor(viewport * 0.6));
  return Math.max(DOCK_MIN_WIDTH, Math.min(max, Math.round(width)));
}

export function rememberedDockWidth(): number {
  const raw = read(WIDTH_KEY);
  const width = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(width) ? width : DOCK_MIN_WIDTH;
}

export function rememberDockWidth(width: number) {
  write(WIDTH_KEY, String(width));
}
