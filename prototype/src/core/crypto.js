/**
 * Password hashing for the DEMO only.
 *
 * Passwords are never stored in plain text, but because this is a browser-only
 * prototype, the hashes still live in the user's own localStorage. This is NOT
 * production security — real AUBH authentication must happen on a server.
 */
export async function hashPassword(email, password) {
  const salt = `tutorcircle:${String(email).trim().toLowerCase()}:`;
  const bytes = new TextEncoder().encode(salt + password);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
