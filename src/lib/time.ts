import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezonePlugin from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import type { DateRange, RangePreset } from "../types.js";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);
dayjs.extend(isoWeek);

export function resolveDateRange(
  preset: RangePreset = "today",
  timezone: string,
): DateRange {
  const now = dayjs().tz(timezone);

  if (preset === "today") {
    return {
      preset,
      label: "今天",
      startAt: now.startOf("day").toISOString(),
      endAt: now.endOf("day").toISOString(),
    };
  }

  if (preset === "yesterday") {
    const target = now.subtract(1, "day");
    return {
      preset,
      label: "昨天",
      startAt: target.startOf("day").toISOString(),
      endAt: target.endOf("day").toISOString(),
    };
  }

  if (preset === "last7days") {
    return {
      preset,
      label: "近7天",
      startAt: now.subtract(6, "day").startOf("day").toISOString(),
      endAt: now.endOf("day").toISOString(),
    };
  }

  return {
    preset,
    label: "近30天",
    startAt: now.subtract(29, "day").startOf("day").toISOString(),
    endAt: now.endOf("day").toISOString(),
  };
}

export function formatDateTime(value: string, timezone: string): string {
  return dayjs(value).tz(timezone).format("YYYY-MM-DD HH:mm:ss");
}

export function nowLabel(timezone: string): string {
  return dayjs().tz(timezone).format("YYYY-MM-DD HH:mm:ss");
}

export function resolveLastCompletedWeekRange(timezone: string): DateRange {
  const now = dayjs().tz(timezone);
  const start = now.startOf("isoWeek").subtract(1, "week");
  const end = start.endOf("isoWeek");

  return {
    preset: "last7days",
    label: `${start.format("MMDD")}~${end.format("MMDD")}`,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}
