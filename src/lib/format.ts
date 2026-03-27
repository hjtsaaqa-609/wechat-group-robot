export const CLEANING_MW_FACTOR = 0.0002;

export function toCleaningMw(area: number): number {
  return area * CLEANING_MW_FACTOR;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(digits)}%`;
}

export function truncate(value: string, maxLength = 18): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

export function formatDays(value: number, digits = 1): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const rounded = Number(value.toFixed(digits));
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return formatNumber(Math.round(rounded), 0);
  }

  return formatNumber(rounded, digits);
}

export function parseRobotCountFromText(text: string): number {
  const matched = text.match(/(\d+)台/);
  return matched ? Number(matched[1]) : 1;
}
