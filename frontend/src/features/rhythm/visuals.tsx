import { likelihoodWord, statusClass, statusLabel, calendarDaysBetween } from "./data";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
export function statusBadge(status: string): string {
  const cls = statusClass(status);
  const glyph = cls === "risk" ? "▼" : cls === "active" ? "◐" : cls === "loyal" ? "◉" : "○";
  return `<span class="status-badge ${cls}"><span aria-hidden="true">${glyph}</span>${esc(statusLabel(status))}</span>`;
}
export function valueChip(value: string): string {
  return `<span class="value-chip"><span aria-hidden="true">◇</span>${esc(value)} value</span>`;
}
export function gapMeter(low: number, high: number, current: number, status: string): string {
  if (!high) return '<span class="muted">Not established</span>';
  const max = Math.max(current * 1.1, high * 2, 1),
    x = (d: number) => 8 + (d / max) * 124;
  return `<div class="gap-meter"><svg viewBox="0 0 140 22" role="img" aria-label="Usual ${low} to ${high} days, now ${current} days"><line x1="8" x2="132" y1="11" y2="11" class="meter-track"/><rect x="${x(low)}" y="7" width="${Math.max(7, x(high) - x(low))}" height="8" rx="4" class="expected-fill"/><line x1="${x(current)}" x2="${x(current)}" y1="3" y2="19" class="${current <= high ? "expected-stroke" : statusClass(status) + "-stroke"}" stroke-width="3"/></svg><span>usual ${low}–${high} d <b>now ${current} d</b></span></div>`;
}
export function rhythmStrip(
  order_dates: string[],
  usual_interval_low_days: number,
  usual_interval_high_days: number,
  last_order_date: string,
  snapshot_date: string,
  mini = false,
): string {
  const gap = calendarDaysBetween(last_order_date, snapshot_date),
    low = usual_interval_low_days,
    high = usual_interval_high_days;
  const today = Date.parse(snapshot_date.slice(0, 10)),
    last = Date.parse(last_order_date.slice(0, 10));
  const dates = order_dates.map(Date.parse).filter(Number.isFinite),
    start = Math.min(...dates, last) - 7 * 86400000,
    end = Math.max(today, last + (high + 5) * 86400000),
    w = 720,
    x = (date: number) => 32 + ((date - start) / (end - start)) * 656,
    y = mini ? 24 : 62;
  const past = high ? Math.max(0, gap - high) : 0,
    cls = past ? "rhythm-current" : high ? "expected" : "neutral",
    bandStart = x(last + low * 86400000),
    bandEnd = x(last + high * 86400000);
  return `<svg class="rhythm-strip ${mini ? "mini" : ""}" viewBox="0 0 ${w} ${mini ? 48 : 158}" role="img" aria-label="Usually orders every ${low} to ${high} days. Last order ${gap} days ago."><line x1="32" x2="688" y1="${y}" y2="${y}" class="rhythm-track"/>${high ? `<rect x="${bandStart}" y="${y - 22}" width="${Math.max(6, bandEnd - bandStart)}" height="44" rx="5" class="expected-band"/>` : ""}${dates.map((d, i) => `<line x1="${x(d)}" x2="${x(d)}" y1="${y - (i === dates.length - 1 ? 20 : 13)}" y2="${y + (i === dates.length - 1 ? 20 : 13)}" class="order-tick"/>`).join("")}<line x1="${x(last)}" x2="${x(today)}" y1="${y}" y2="${y}" class="${cls}-stroke" stroke-width="2"/>${past && high ? `<line x1="${bandEnd}" x2="${x(today)}" y1="${y + 25}" y2="${y + 25}" class="rhythm-current-stroke" stroke-dasharray="3 4"/>` : ""}<circle cx="${x(today)}" cy="${y}" r="5" class="${cls}-fill"/>${mini ? "" : `<text x="32" y="120" class="svg-muted">${esc(new Date(start).toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" }))}</text><text x="${Math.min(650, Math.max(70, x(last)))}" y="39" text-anchor="middle" class="svg-muted">Last order</text><text x="${Math.min(670, Math.max(130, (bandStart + bandEnd) / 2))}" y="120" text-anchor="middle" class="svg-expected">${high ? "Usual next-order window" : "Rhythm not established"}</text><text x="${x(today)}" y="24" text-anchor="end" class="svg-text">Today</text>${past && high ? `<text x="688" y="146" text-anchor="end" class="svg-current">${past} days past usual window</text>` : ""}`}</svg>`;
}
export function returnWindowDial(pct: number): string {
  const length = 251.33;
  return `<svg class="return-dial" viewBox="0 0 220 150" role="img" aria-label="${pct}% ${likelihoodWord(pct)} chance of ordering within 30 days"><path d="M30 110 A80 80 0 0 1 190 110" class="dial-track" fill="none" stroke-width="13" stroke-linecap="round"/><path d="M30 110 A80 80 0 0 1 190 110" class="dial-value" fill="none" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(length * pct) / 100} ${length}"/><text x="110" y="100" text-anchor="middle" class="dial-number">${pct}%</text><text x="110" y="126" text-anchor="middle" class="svg-muted">${likelihoodWord(pct)}</text></svg>`;
}
export function HtmlVisual({ html, className = "" }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
export function StatusBadge({ status }: { status: string }) {
  return <HtmlVisual html={statusBadge(status)} />;
}
export function ValueChip({ value }: { value: string }) {
  return <HtmlVisual html={valueChip(value)} />;
}
