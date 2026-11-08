import { describe, expect, it } from "vitest";
import { isWeekday, weekdaysFrom } from "./weekday";

describe("weekdaysFrom", () => {
  it("starts on Sunday by default-style input", () => {
    expect(weekdaysFrom(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("wraps around for a Monday week start", () => {
    expect(weekdaysFrom(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("wraps around for a Saturday week start", () => {
    expect(weekdaysFrom(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
});

describe("isWeekday", () => {
  it.each([0, 3, 6])("accepts %d", (day) => {
    expect(isWeekday(day)).toBe(true);
  });

  it.each([-1, 7, 1.5, "1", null])("rejects %j", (value) => {
    expect(isWeekday(value)).toBe(false);
  });
});
