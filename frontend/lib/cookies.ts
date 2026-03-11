function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

export function setLoggedInCookie(): void {
  if (typeof document === "undefined") return;
  const secureAttribute = isSecureContext() ? "; Secure" : "";
  // biome-ignore lint/suspicious/noDocumentCookie: Frontend-only cookie for middleware gating.
  document.cookie = `lw_logged_in=1; Path=/; SameSite=Lax${secureAttribute}`;
}

export function clearLoggedInCookie(): void {
  if (typeof document === "undefined") return;
  const secureAttribute = isSecureContext() ? "; Secure" : "";
  // biome-ignore lint/suspicious/noDocumentCookie: Frontend-only cookie for middleware gating.
  document.cookie = `lw_logged_in=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureAttribute}`;
}
