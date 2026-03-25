// Philippine Time (UTC+8) helpers and DTR schedule constants

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

/**
 * Returns the current Date object representing now in UTC
 * (standard JS Date — all comparisons should use toMinutes helper)
 */
export const getPHTNow = () => new Date();

/**
 * Returns today's date string in PHT timezone as "YYYY-MM-DD"
 */
export const getPHTDateString = () => {
  const now = new Date();
  // Shift to PHT
  const pht = new Date(now.getTime() + PHT_OFFSET_MS);
  return pht.toISOString().slice(0, 10);
};

/**
 * Converts a Date object to PHT minutes-since-midnight (0–1439)
 * @param {Date} date
 * @returns {number}
 */
export const toMinutes = (date) => {
  const pht = new Date(date.getTime() + PHT_OFFSET_MS);
  return pht.getUTCHours() * 60 + pht.getUTCMinutes();
};

/**
 * Current PHT minutes since midnight
 */
export const nowMinutes = () => toMinutes(new Date());

// ─── Schedule Constants (minutes since midnight) ─────────────────────────────

export const SCHEDULE = {
  clockInStart: 8 * 60,       // 08:00
  gracePeriodEnd: 8 * 60 + 30, // 08:30 — auto clock-in fires here
  clockOutStd: 17 * 60,        // 17:00
  retentionEnd: 17 * 60 + 30,  // 17:30 — auto clock-out fires here
};

export const BREAKS = {
  morning: {
    windowOpen: 9 * 60 + 50,   // 09:50 — Start Break button becomes available
    start: 10 * 60,             // 10:00 — auto start break
    end: 10 * 60 + 15,          // 10:15 — auto end break
  },
  lunch: {
    windowOpen: 11 * 60 + 50,  // 11:50
    start: 12 * 60,             // 12:00 — auto start break
    end: 13 * 60,               // 13:00 — official end (manual end allowed)
    autoEnd: 13 * 60 + 10,      // 13:10 — auto end if not manually ended
  },
  afternoon: {
    windowOpen: 14 * 60 + 50,  // 14:50
    start: 15 * 60,             // 15:00 — auto start break
    end: 15 * 60 + 15,          // 15:15 — auto end break
  },
};

// ─── Work Stats Computation ───────────────────────────────────────────────────

/**
 * Returns the duration in minutes between two Date objects.
 * Returns 0 if either is falsy.
 */
const diffMinutes = (start, end) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
};

/**
 * Computes totalWorkMinutes, lateMinutes, undertimeMinutes from an attendance doc.
 * @param {object} attendance  Mongoose attendance document (plain or lean)
 * @returns {{ totalWorkMinutes: number, lateMinutes: number, undertimeMinutes: number }}
 */
export const computeWorkStats = (attendance) => {
  const { clockIn, clockOut, breaks } = attendance;

  if (!clockIn?.time || !clockOut?.time) {
    return { totalWorkMinutes: 0, lateMinutes: 0, undertimeMinutes: 0 };
  }

  // Gross duration from clock-in to clock-out
  const grossMinutes = diffMinutes(clockIn.time, clockOut.time);

  // Sum of all break durations
  const breakKeys = ["morning", "lunch", "afternoon"];
  const totalBreakMinutes = breakKeys.reduce((acc, key) => {
    const b = breaks?.[key];
    return acc + diffMinutes(b?.start, b?.end);
  }, 0);

  const totalWorkMinutes = Math.max(0, grossMinutes - totalBreakMinutes);

  // Late minutes: if clock-in is after 08:00
  const clockInMinutes = toMinutes(new Date(clockIn.time));
  const lateMinutes = Math.max(0, clockInMinutes - SCHEDULE.clockInStart);

  // Undertime minutes: if clock-out is before 17:00
  const clockOutMinutes = toMinutes(new Date(clockOut.time));
  const undertimeMinutes = Math.max(0, SCHEDULE.clockOutStd - clockOutMinutes);

  return { totalWorkMinutes, lateMinutes, undertimeMinutes };
};
