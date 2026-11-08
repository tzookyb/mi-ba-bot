/**
 * Days of the week as numbers, Sunday = 0 ... Saturday = 6.
 * This matches JavaScript's `Date.getDay()`. Groups choose their own week start day
 * (default Sunday, see docs/SPEC.md section 7), so code must never assume Sunday comes first.
 */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

/** The seven weekdays in display order for a group whose week starts on `weekStart`. */
export function weekdaysFrom(weekStart: Weekday): Weekday[] {
  return WEEKDAYS.map((offset) => ((weekStart + offset) % 7) as Weekday);
}
