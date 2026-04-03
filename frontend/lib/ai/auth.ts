/**
 * AI Auth Utilities
 *
 * Verifies user authentication for AI API routes by forwarding
 * the token to the FastAPI backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

export interface AIUser {
  id: number;
  username: string;
  role: string;
}

/**
 * Verify the user's access token by calling the backend /auth/me endpoint.
 * Returns user info if valid, null if not authenticated.
 */
export async function verifyAIUser(
  authHeader: string | null,
): Promise<AIUser | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: authHeader,
        "X-API-Key": API_KEY,
      },
    });

    if (!res.ok) return null;

    const user = await res.json();
    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  } catch {
    return null;
  }
}
