const userAgents: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.162 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 7.0; Moto C Build/NRD90M.059) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.75 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36",
  "Mozilla/5.0 (X11; Linux i686) AppleWebKit/534.30 (KHTML, like Gecko) Chrome/12.0.742.100 Safari/534.30",
];

export function randUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/** Return empty string if value is null/undefined, otherwise return the string */
export function get(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Generate a unique name, appending index if already taken */
export function uniqueName(names: Record<string, number>, name: string): string {
  const trimmed = name.trim();
  if (!(trimmed in names)) {
    names[trimmed] = 0;
    return trimmed;
  }
  names[trimmed]++;
  return `${trimmed} ${names[trimmed]}`;
}

/** Replace URL-unsafe characters */
export function urlSafe(s: string): string {
  return s.replace(/-/g, "+").replace(/_/g, "/");
}

export function base64RawStdDecode(s: string): string {
  // Add padding if necessary
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function base64RawURLDecode(s: string): string {
  // URL-safe base64: replace - with + and _ with /
  const std = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}
