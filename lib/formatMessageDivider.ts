function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatMessageDivider(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000
  );

  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  let dayLabel: string;
  if (diffDays === 0) {
    dayLabel = "Today";
  } else if (diffDays === 1) {
    dayLabel = "Yesterday";
  } else {
    dayLabel = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
  }

  return `${dayLabel} ${time}`;
}

// iMessage-style grouping: a new divider appears for the first message and
// whenever a big enough gap (or a day boundary) separates it from the one
// before it, rather than on every single message.
export function shouldShowDivider(
  current: { created_at: string },
  previous: { created_at: string } | undefined
): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.created_at);
  const previousDate = new Date(previous.created_at);
  if (startOfDay(currentDate).getTime() !== startOfDay(previousDate).getTime()) return true;
  const oneHourMs = 60 * 60 * 1000;
  return currentDate.getTime() - previousDate.getTime() >= oneHourMs;
}
