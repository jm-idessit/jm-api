/**
 * JWT from Authorization: Bearer (preferred) or httpOnly cookie.
 * Bearer works when the browser blocks cross-site cookies (e.g. mobile Safari).
 */
export const getBearerOrCookie = (req, cookieName) => {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return req.cookies?.[cookieName] || null;
};
