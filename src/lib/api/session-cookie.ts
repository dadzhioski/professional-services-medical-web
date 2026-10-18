import "server-only";

export function sessionCookieName(publicOrigin: string) {
  return publicOrigin.startsWith("https:") ? "__Host-platform-session" : "platform-session-local";
}

const validValue = (value: string) => /^[A-Za-z0-9_+/=-]*$/.test(value) && value.length <= 4096;

export function incomingSession(cookies: { name: string; value: string }[], name: string): string | undefined {
  const matches = cookies.filter(cookie => cookie.name === name);
  if (matches.length !== 1 || !matches[0].value || !validValue(matches[0].value)) return undefined;
  return matches[0].value;
}

export type SessionCookie = {
  name: string; value: string; path: "/"; httpOnly: true; secure: boolean;
  sameSite: "lax"; maxAge?: number; expires?: Date;
};

export function isDeletedSession(cookie: SessionCookie): boolean {
  // Browsers give Max-Age precedence when both expiry attributes are present.
  return cookie.maxAge !== undefined ? cookie.maxAge <= 0 :
    !!cookie.expires && cookie.expires.getTime() <= Date.now();
}

// Parse each Set-Cookie separately (Expires contains a comma). Validate the entire
// response before applying any cookie; never forward an unexpected cookie/domain.
export function sessionChanges(headers: Headers, name: string): SessionCookie[] {
  return headers.getSetCookie().map(line => {
    const [pair, ...attributes] = line.split(";").map(part => part.trim());
    const separator = pair.indexOf("=");
    const value = pair.slice(separator + 1);
    if (separator < 0 || pair.slice(0, separator) !== name || !validValue(value)) throw new Error("Invalid session response");
    const parsed = new Map<string, string>();
    for (const attribute of attributes) {
      const split = attribute.indexOf("=");
      const key = (split < 0 ? attribute : attribute.slice(0, split)).toLowerCase();
      const content = split < 0 ? "" : attribute.slice(split + 1);
      if (parsed.has(key) || !["path", "httponly", "secure", "samesite", "max-age", "expires"].includes(key)) throw new Error("Invalid session response");
      parsed.set(key, content);
    }
    const secure = name === "__Host-platform-session";
    if (parsed.get("path") !== "/" || parsed.get("httponly") !== "" ||
        parsed.get("samesite")?.toLowerCase() !== "lax" || parsed.has("secure") !== secure ||
        (secure && parsed.get("secure") !== "")) throw new Error("Invalid session response");
    const cookie: SessionCookie = { name, value, path: "/", httpOnly: true, secure, sameSite: "lax" };
    if (parsed.has("max-age")) {
      const age = parsed.get("max-age")!;
      if (!/^-?\d+$/.test(age) || !Number.isSafeInteger(Number(age))) throw new Error("Invalid session response");
      cookie.maxAge = Number(age);
    }
    if (parsed.has("expires")) {
      cookie.expires = new Date(parsed.get("expires")!);
      if (!Number.isFinite(cookie.expires.getTime())) throw new Error("Invalid session response");
    }
    if (!value && !isDeletedSession(cookie)) throw new Error("Invalid session response");
    return cookie;
  });
}
