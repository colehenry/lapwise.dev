import { useSyncExternalStore } from "react";

/** One Clutch bubble open at a time, site-wide. */
let openId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openCorner(id: string) {
  if (openId === id) return;
  openId = id;
  emit();
}

export function closeCorner(id: string) {
  if (openId !== id) return;
  openId = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return openId;
}

/** Whether this corner is the one currently open. */
export function useCornerOpen(id: string): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot) === id;
}
