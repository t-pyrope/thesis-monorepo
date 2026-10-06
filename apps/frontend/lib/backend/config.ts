export function getBackend() {
  const mode = process.env.BACKEND_MODE ?? "serverless";
  if (mode === "serverless") return { mode, url: null } as const;
  if (mode !== "traditional" && mode !== "event-driven") {
    throw new Error(
      "BACKEND_MODE must be serverless, traditional or event-driven",
    );
  }
  const variable =
    mode === "traditional"
      ? "TRADITIONAL_BACKEND_URL"
      : "EVENT_DRIVEN_BACKEND_URL";
  const value = process.env[variable];
  if (!value) throw new Error(`${variable} is required for ${mode} backend`);
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(`${variable} must be an HTTP(S) origin without a path`);
  }
  return { mode, url: url.origin } as const;
}

export function backendCookieName(mode: string) {
  return `__Host-app-session-${mode}`;
}
