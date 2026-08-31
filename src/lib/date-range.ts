/**
 * The span of days the statistics screen's calendar builds up, and the one rule that
 * builds it. Pure, and separate from the calendar that draws it, like the rest of
 * lib/ — the rule has three branches and is worth testing without a renderer.
 */

/** A user-picked span of days, both ends inclusive. */
export interface DateRange {
  start: string;
  /**
   * Null while only the first day has been tapped. The range means nothing yet then,
   * which is what lets the block keep showing its hint instead of a one-day total the
   * user did not ask for.
   */
  end: string | null;
}

/**
 * The next tap's effect on the selection:
 *
 * - nothing selected, or a finished range — the tapped day opens a new one;
 * - a day at or after the open range's start — it closes the range (the same day twice
 *   is a legal one-day range);
 * - a day before it — the range reopens from there rather than flipping its ends, so
 *   `start` always means the day that was tapped first, and a range never comes out
 *   backwards for the query that reads it.
 */
export function extendRange(range: DateRange | null, date: string): DateRange {
  if (range === null || range.end !== null || date < range.start) {
    return { start: date, end: null };
  }
  return { start: range.start, end: date };
}
