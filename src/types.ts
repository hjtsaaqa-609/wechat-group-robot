export type RangePreset = "today" | "yesterday" | "last7days" | "last30days";

export type DashboardSummaryReportConfig = {
  type: "dashboard-summary";
};

export type OperationsSummaryReportConfig = {
  type: "operations-summary";
  range?: RangePreset;
  topN?: number;
};

export type CleaningAnomaliesReportConfig = {
  type: "cleaning-anomalies";
  range?: RangePreset;
  limit?: number;
  skipWhenEmpty?: boolean;
};

export type WeeklyOperationsReportConfig = {
  type: "weekly-operations";
  detailLimit?: number;
};

export type ReportConfig =
  | DashboardSummaryReportConfig
  | OperationsSummaryReportConfig
  | CleaningAnomaliesReportConfig
  | WeeklyOperationsReportConfig;

export type JobConfig = {
  name: string;
  enabled?: boolean;
  cron: string;
  timezone?: string;
  webhook?: string;
  webhookEnv?: string;
  reports: ReportConfig[];
};

export type AppConfig = {
  timezone?: string;
  jobs: JobConfig[];
};

export type DateRange = {
  preset: RangePreset;
  label: string;
  startAt: string;
  endAt: string;
};

export type RenderedReport = {
  title: string;
  markdown: string;
};

export type ReportContext = {
  jobName: string;
  timezone: string;
  baseUrl: string;
  executedAt: string;
};
