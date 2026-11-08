export function fmtNum(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = Math.abs(Math.round(n)).toString();
  return sign + s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function fmtEuro(cents: number, signed = false): string {
  const sign = cents < 0 ? "-" : signed && cents > 0 ? "+" : "";
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const c = (abs % 100).toString().padStart(2, "0");
  return sign + "\u20AC" + fmtNum(euros) + "," + c;
}

export function fmtSigned(n: number): string {
  return (n > 0 ? "+" : "") + fmtNum(n);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "adesso";
  const m = Math.round(s / 60);
  if (m < 60) return m + " min fa";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h fa";
  return Math.floor(h / 24) + " g fa";
}

export function duration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? h + " h " + (m % 60) + " min" : m + " min";
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
