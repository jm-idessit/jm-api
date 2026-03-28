import { computeWorkStats } from "../utils/timeUtils.js";

/**
 * Closes any break that has a start but no end time.
 * @param {import("mongoose").Document} record
 * @param {Date} time
 * @param {boolean} auto
 */
export const closeOpenBreaks = async (record, time, auto = true) => {
  const keys = ["morning", "lunch", "afternoon"];
  let changed = false;
  for (const key of keys) {
    const brk = record.breaks[key];
    if (brk?.start && !brk?.end) {
      record.breaks[key].end = time;
      record.breaks[key].isAutomatic = auto;
      changed = true;
    }
  }
  if (changed) await record.save();
  return record;
};

export const saveStats = async (record) => {
  const stats = computeWorkStats(record.toObject());
  record.totalWorkMinutes = stats.totalWorkMinutes;
  record.lateMinutes = stats.lateMinutes;
  record.undertimeMinutes = stats.undertimeMinutes;
  await record.save();
  return record;
};
