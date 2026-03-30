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

export type InternalWebhookChannelConfig = {
  type: "internal-webhook";
  webhook?: string;
  webhookEnv?: string;
  maxMarkdownBytes?: number;
};

export type InternalAppMessageChannelConfig = {
  type: "internal-app-message";
  corpId?: string;
  corpIdEnv?: string;
  corpSecret?: string;
  corpSecretEnv?: string;
  agentId?: number;
  agentIdEnv?: string;
  touser?: string;
  toparty?: string;
  totag?: string;
  enableDuplicateCheck?: boolean;
  duplicateCheckInterval?: number;
  maxMarkdownBytes?: number;
};

export type ExternalGroupTaskChannelConfig = {
  type: "external-group-task";
  corpId?: string;
  corpIdEnv?: string;
  corpSecret?: string;
  corpSecretEnv?: string;
  sender: string;
  chatType?: "single" | "group";
  externalUserIds?: string[];
  allowSelect?: boolean;
  textPrefix?: string;
  maxTextLength?: number;
};

export type WecomChannelConfig =
  | InternalWebhookChannelConfig
  | InternalAppMessageChannelConfig
  | ExternalGroupTaskChannelConfig;

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
  jitterSeconds?: number;
  webhook?: string;
  webhookEnv?: string;
  channel?: WecomChannelConfig;
  reports: ReportConfig[];
};

export type AppConfig = {
  timezone?: string;
  jobs: JobConfig[];
};

export type ReportStateUpdate = {
  lastPlatformRobotCount?: number;
  lastPeriodLabel?: string;
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
  stateUpdate?: ReportStateUpdate;
};

export type ReportContext = {
  jobName: string;
  timezone: string;
  baseUrl: string;
  executedAt: string;
};
