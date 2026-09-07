import { buildReminderPlans, type ReminderHabit } from '../reminder-plan';
import { daysToMask } from '../schedule';

const EVERY_DAY = 127;
const WEEKDAYS = daysToMask([0, 1, 2, 3, 4]);
const MONDAY = daysToMask([0]);
const TUESDAY = daysToMask([1]);

function habit(id: string, time: string, mask: number): ReminderHabit {
  return { id, name: id, emoji: '🔥', reminder_time: time, schedule_mask: mask };
}

/** Ids of the habits each plan covers, keyed by its trigger, for readable expectations. */
function summarize(habits: ReminderHabit[]): Record<string, string[]> {
  const plans = buildReminderPlans(habits);
  return Object.fromEntries(
    plans.map((plan) => [
      `${plan.time}/${plan.bit === null ? 'daily' : plan.bit}`,
      plan.subjects.map((subject) => subject.id),
    ])
  );
}

describe('buildReminderPlans', () => {
  it('collapses a habit scheduled every day into one daily trigger', () => {
    expect(summarize([habit('a', '09:00', EVERY_DAY)])).toEqual({ '09:00/daily': ['a'] });
  });

  it('gives a partial schedule one trigger per weekday', () => {
    expect(summarize([habit('a', '09:00', daysToMask([0, 2]))])).toEqual({
      '09:00/0': ['a'],
      '09:00/2': ['a'],
    });
  });

  // The point of the whole module: without grouping this is three habits x seven days
  // = 21 of the ~64 requests iOS allows.
  it('puts habits sharing a time and a schedule in one notification', () => {
    expect(
      summarize([
        habit('a', '09:00', EVERY_DAY),
        habit('b', '09:00', EVERY_DAY),
        habit('c', '09:00', EVERY_DAY),
      ])
    ).toEqual({ '09:00/daily': ['a', 'b', 'c'] });
  });

  it('groups per weekday when the schedules only partly overlap', () => {
    expect(summarize([habit('a', '09:00', MONDAY), habit('b', '09:00', WEEKDAYS)])).toEqual({
      '09:00/0': ['a', 'b'],
      '09:00/1': ['b'],
      '09:00/2': ['b'],
      '09:00/3': ['b'],
      '09:00/4': ['b'],
    });
  });

  it('keeps different times apart', () => {
    expect(summarize([habit('a', '09:00', EVERY_DAY), habit('b', '21:30', EVERY_DAY)])).toEqual({
      '09:00/daily': ['a'],
      '21:30/daily': ['b'],
    });
  });

  // Two habits covering all seven days between them are still two sets, not one.
  it('does not collapse into a daily trigger when the days carry different habits', () => {
    const plans = buildReminderPlans([
      habit('a', '09:00', daysToMask([0, 1, 2, 3, 4, 5, 6])),
      habit('b', '09:00', MONDAY),
    ]);
    expect(plans.every((plan) => plan.bit !== null)).toBe(true);
    expect(plans).toHaveLength(7);
  });

  it('carries the hour and minute of its time', () => {
    const [plan] = buildReminderPlans([habit('a', '07:05', EVERY_DAY)]);
    expect(plan).toMatchObject({ hour: 7, minute: 5 });
  });

  it('keeps the order habits came in, so the banner reads like the habit list', () => {
    const plans = buildReminderPlans([habit('b', '09:00', TUESDAY), habit('a', '09:00', TUESDAY)]);
    expect(plans[0].subjects.map((subject) => subject.id)).toEqual(['b', 'a']);
  });

  it('plans nothing for an empty list', () => {
    expect(buildReminderPlans([])).toEqual([]);
  });
});
