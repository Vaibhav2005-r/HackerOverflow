export type Band = "day" | "evening" | "night";

/** Local-hour → time band (DAY 06–17:59, EVENING 18–21:59, NIGHT 22–05:59). */
export function bandForHour(hour: number): Band {
  if (hour >= 6 && hour < 18) return "day";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

/** Band for an instant, in Asia/Kolkata (IST, UTC+5:30, no DST). */
export function bandForDate(d: Date): Band {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return bandForHour(ist.getUTCHours());
}
