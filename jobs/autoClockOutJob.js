import Attendance from "../models/attendanceModel.js";
import {
  getPHTNow,
  getPHTDateString,
  nowMinutes,
  SCHEDULE,
} from "../utils/timeUtils.js";
import { closeOpenBreaks, saveStats } from "../services/attendanceRecordUtils.js";

/**
 * Nominal auto clock-out instant on a given PHT calendar date (YYYY-MM-DD).
 * Matches schedule: 5:15 PM or 10:30 PM when overtime was enabled.
 */
const nominalAutoClockOutOnDate = (dateStr, overtimeEnabled) => {
  if (overtimeEnabled) {
    return new Date(
      `${dateStr}T${String(Math.floor(SCHEDULE.overtimeAutoEnd / 60)).padStart(2, "0")}:${String(SCHEDULE.overtimeAutoEnd % 60).padStart(2, "0")}:00+08:00`
    );
  }
  const m = SCHEDULE.retentionEnd;
  return new Date(
    `${dateStr}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00+08:00`
  );
};

const isOpenShift = (record) =>
  Boolean(record?.clockIn?.time) && !record?.clockOut?.time;

/**
 * Server-side auto clock-out (runs without the client app open).
 * - Today (PHT): when current time is past the threshold, uses real "now" (same as POST /auto-clock-out).
 * - Past dates: backfills nominal 5:15 PM or 10:30 PM on that date from record.overtimeEnabled.
 */
export async function runAutoClockOutJob() {
  const today = getPHTDateString();
  const minutes = nowMinutes();
  const now = getPHTNow();

  const candidates = await Attendance.find({
    "clockIn.time": { $exists: true, $ne: null },
  });

  let closed = 0;
  const errors = [];

  for (const record of candidates) {
    if (!isOpenShift(record)) continue;

    try {
      if (record.date < today) {
        const outTime = nominalAutoClockOutOnDate(record.date, Boolean(record.overtimeEnabled));
        let r = record;
        r = await closeOpenBreaks(r, outTime, true);
        r.clockOut = { time: outTime, isAutomatic: true };
        await saveStats(r);
        closed += 1;
        continue;
      }

      if (record.date !== today) continue;

      const targetAutoEnd = record.overtimeEnabled
        ? SCHEDULE.overtimeAutoEnd
        : SCHEDULE.retentionEnd;

      if (minutes < targetAutoEnd) continue;

      let r = record;
      r = await closeOpenBreaks(r, now, true);
      r.clockOut = { time: now, isAutomatic: true };
      await saveStats(r);
      closed += 1;
    } catch (err) {
      errors.push({ id: record._id?.toString?.(), message: err?.message });
    }
  }

  return { ok: true, today, closed, errors };
}
