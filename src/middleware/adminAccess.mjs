function parseCookies(cookieHeader) {
  const cookies = {};
  String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const idx = entry.indexOf("=");
      if (idx === -1) return;
      const key = entry.slice(0, idx).trim();
      const value = entry.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(value);
    });
  return cookies;
}

export function extractAdminToken(headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
  );

  const cookies = parseCookies(normalized.cookie);
  if (cookies.spiritcore_admin) {
    return { token: cookies.spiritcore_admin, source: "cookie" };
  }

  const xAdmin = normalized["x-admin-key"];
  if (typeof xAdmin === "string" && xAdmin.trim()) {
    return { token: xAdmin.trim(), source: "x-admin-key" };
  }

  const xApi = normalized["x-api-key"];
  if (typeof xApi === "string" && xApi.trim()) {
    return { token: xApi.trim(), source: "x-api-key" };
  }

  const auth = normalized.authorization;
  if (typeof auth === "string" && auth.trim()) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return { token: match[1].trim(), source: "authorization" };
    }
  }

  return { token: null, source: null };
}

export function createAdminAccessGuard({ config, logger }) {
  return async function requireAdminAccess(req, reply) {
    const mode = config?.adminAuth?.mode || "auto";
    const expectedToken = config?.adminAuth?.apiKey || "";

    if (mode === "off") {
      req.adminAccess = { allowed: true, bypassed: true, mode, source: "off" };
      return;
    }

    if (!expectedToken) {
      if (mode === "auto" && config?.env !== "production") {
        req.adminAccess = { allowed: true, bypassed: true, mode, source: "auto-dev-no-secret" };
        return;
      }
      return reply.code(403).send({
        ok: false,
        error: "ADMIN_AUTH_UNAVAILABLE",
        message: "Admin access is not configured.",
      });
    }

    const { token, source } = extractAdminToken(req.headers || {});
    if (token && token === expectedToken) {
      req.adminAccess = { allowed: true, bypassed: false, mode, source };
      return;
    }

    logger?.warn?.({
      route: req.routerPath || req.url,
      method: req.method,
      source,
      mode,
    }, "[admin] denied");

    return reply.code(403).send({
      ok: false,
      error: "ADMIN_FORBIDDEN",
      message: "Admin access denied.",
    });
  };
}
