/** Time-of-day greeting based on the user's timezone. */
export function greeting(timezone = "Asia/Manila", name?: string | null) {
  let hour = new Date().getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }).format(new Date()),
    );
  } catch {
    // fall back to local hour
  }

  const part =
    hour < 5
      ? "Still up"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";

  const first = name?.trim()?.split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** Long date label in the user's timezone, e.g. "Monday, 21 July". */
export function longDate(timezone = "Asia/Manila") {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
  }
}
