import type { DateRange } from "../types.js";

export type SiteStatsResponse = {
  summary: {
    siteCount: number;
    robotCount: number;
    installedCapacity: number;
    alarmCount: number;
  };
  sites: Array<{
    id: string;
    name: string;
    robots: number;
  }>;
};

export type RobotStatsResponse = {
  summary: {
    robotCount: number;
    onlineCount: number;
    offlineCount: number;
    abnormalCount: number;
    normalCount: number;
  };
  lifeCycleDistribution: Array<{
    label: string;
    value: number;
  }>;
};

export type CustomerStatsResponse = {
  summary: {
    customerCount: number;
    installedCustomerCount: number;
    siteCount: number;
    installedSiteCount: number;
    robotCount: number;
    totalInstalledCapacity: number;
    installedRobotCapacity: number;
    preliminaryRobotCount: number;
    preliminarySchemeCapacity: number;
    ownedPowerStationScale: number;
    operationMaintenancePowerStationScale: number;
    averageRobotsPerCustomer: number;
    averageSitesPerCustomer: number;
  };
};

export type ProjectStatsResponse = {
  summary: {
    logCount: number;
    siteCount: number;
    customerCount: number;
    staffCount: number;
    issueCount: number;
    issueRate: number;
    averageDailySiteStaff: number;
    soloLogCount: number;
    outgoingYieldMonth?: string;
    outgoingYieldRate?: number | null;
    outgoingYieldShippedCount?: number;
    outgoingYieldDefectCount?: number;
    outgoingYieldGoodCount?: number;
    shippingAccuracyMonth?: string;
    shippingAccuracyRate?: number | null;
    shippingAccuracyOrderCount?: number;
    shippingAccuracyErrorCount?: number;
    shippingAccuracyCorrectCount?: number;
  };
  quality?: {
    year: number;
    windowDays: number;
    installOnceSuccess: QualityMetric;
    opsSuccess: QualityMetric;
    productionOutgoingYield: {
      currentMonth: ProductionYieldSnapshot;
      yearToDate: ProductionYieldSnapshot;
      trend: ProductionYieldSnapshot[];
    };
    productionShippingAccuracy: {
      currentMonth: ShippingAccuracySnapshot;
      yearToDate: ShippingAccuracySnapshot;
      trend: ShippingAccuracySnapshot[];
    };
  };
};

export type QualityMetric = {
  label: string;
  targetRate: number;
  actualRate: number;
  successCount: number;
  totalCount: number;
  failureCount: number;
  grade: string;
};

export type ProductionYieldSnapshot = {
  label: string;
  shippedCount: number;
  defectCount: number;
  goodCount: number;
  yieldRate: number | null;
};

export type ShippingAccuracySnapshot = {
  label: string;
  orderCount: number;
  errorCount: number;
  correctCount: number;
  accuracyRate: number | null;
};

export type DashboardData = {
  site: SiteStatsResponse;
  robot: RobotStatsResponse;
  customer: CustomerStatsResponse;
  project: ProjectStatsResponse;
};

export type OperationsSummary = {
  customerCount: number;
  siteCount: number;
  robotCount: number;
  faultCount: number;
  faultRate: number;
  levelTwoRobotRate: number;
  annualizedLevelTwoFaultCount: number;
  takeoverCountPerGW: number;
  onsiteMaintenanceCountPerGW: number;
  consumableReplacementCountPerGW: number;
  monthlyCleaningArea: number;
  averageCleanliness: number;
  batteryHealth: number;
  batteryHealthStatus: string;
  batteryAttention: string;
};

export type OperationsRankingRow = {
  id: string;
  name: string;
  siteId?: string;
  siteName?: string;
  cleaningArea?: number;
  cleanliness?: number;
  count?: number;
};

export type OperationsReport = {
  summary: OperationsSummary;
  faultCategoryByLevel: Array<{
    level: string;
    data: Array<{
      name: string;
      value: number;
    }>;
  }>;
  cleaningRobotRanking: {
    top: OperationsRankingRow[];
    bottom: OperationsRankingRow[];
  };
  cleanlinessRobotRanking: {
    top: OperationsRankingRow[];
    bottom: OperationsRankingRow[];
  };
  levelTwoRankings: {
    robots: OperationsRankingRow[];
    sites: OperationsRankingRow[];
    customers: OperationsRankingRow[];
  };
};

export type CleaningAnomalySummary = {
  totalTaskCount: number;
  validDurationTaskCount: number;
  anomalyCount: number;
  areaPerHourP50: number;
  areaPerHourP95: number;
  thresholdAreaPerHour: number;
};

export type CleaningAnomalyRow = {
  taskId: string;
  siteName: string;
  robotName: string;
  startAt: string;
  endAt: string;
  durationHours: number;
  taskArea: number;
  areaPerHour: number | null;
  equivalentMw: number;
  reason: string;
};

export type CleaningAnomalyReport = {
  summary: CleaningAnomalySummary;
  rows: CleaningAnomalyRow[];
};

export type TodoStatsResponse = {
  summary: {
    totalCount: number;
    pendingCount: number;
    processedCount: number;
  };
  typeDistribution: Array<{
    label: string;
    value: number;
  }>;
  trend: Array<{
    label: string;
    totalCount: number;
    pendingCount: number;
    processedCount: number;
  }>;
};

export type TodoListItem = {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  processedOperatorName: string | null;
  customerName: string | null;
  siteId: string | null;
  siteName: string | null;
};

export type TodoListResponse = {
  items: TodoListItem[];
};

export type FieldTodosResponse = {
  summary: {
    faultCount: number;
    todoCount: number;
    totalCount: number;
    faultAvgDurationHours: number;
    todoAvgDurationHours: number;
  };
  faults: Array<{
    id: string;
    level: string;
    status: string;
    startAt: string;
    customerName: string;
    siteId: string;
    siteName: string;
    robotName: string;
    description: string;
  }>;
  todos: TodoListItem[];
};

export type CleaningQualityResponse = {
  summary: {
    expectedSiteCount: number;
    participatingSiteCount: number;
    belowExpectedSiteCount: number;
    belowExpectedRatio: number;
    averageActualCleanliness: number;
    averageExpectedCleanliness: number;
    averageGap: number;
    unmatchedSiteCount: number;
  };
  belowExpectedSites: Array<{
    siteId: string;
    siteName: string;
    customerName: string;
    expectedCleanliness: number | null;
    actualCleanliness: number;
    gap: number | null;
    sampleCount: number;
    belowExpected: boolean;
    unmatchedReason: string | null;
  }>;
};

export type PowerBoostResponse = {
  summary: {
    generationSiteCount: number;
    participatingSiteCount: number;
    belowExpectedSiteCount: number;
    belowExpectedRatio: number;
    averageActualBoostRatio: number;
    averageExpectedBoostRatio: number;
    averageGapRatio: number;
  };
  belowExpectedSites: Array<{
    siteId: string;
    siteName: string;
    customerName: string;
    actualBoostRatio: number | null;
    expectedBoostRatio: number | null;
    gapRatio: number | null;
    meetsExpected: boolean;
    dataDays: number;
    validDays: number;
    cleaningEquivalentHours: number | null;
    controlEquivalentHours: number | null;
    cleaningGeneration: number;
    controlGeneration: number;
  }>;
};

export type BusinessStatsResponse = {
  summary: {
    totalRobots: number;
    formalOperation: number;
    trialRun: number;
    suspendedWorking: number;
    maintenance: number;
    scrapped: number;
  };
  statusDistribution: Array<{
    status: string;
    label: string;
    count: number;
  }>;
};

export type CustomerComplaintsResponse = {
  summary: {
    complaintCount: number;
    customerCount: number;
    siteCount: number;
  };
};

export type InspectionStatsResponse = {
  summary: {
    taskCount: number;
    inspectedCount: number;
    inspectingCount: number;
    waitingCount: number;
    abortedCount: number;
    completionRate: number;
    totalInspectionArea: number;
    totalTargetArea: number;
    photoCount: number;
    savedPhotoCount: number;
    photoPerMw: number;
    abnormalPhotoCount: number;
    abnormalModuleCount: number;
    clearedModuleCount: number;
    abnormalModuleClearRate: number;
    totalModuleCount: number;
    severeAbnormalModuleCount: number;
    severeAbnormalModuleRatio: number;
    avgCleanliness: number;
  };
};

type JsonEnvelope<T> = {
  code: string;
  message?: string;
  data: T;
};

export class DasClient {
  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
  ) {}

  async authenticate(): Promise<void> {
    const data = await this.postJson<{ username: string }>("/api/auth/login", {
      username: this.username,
      password: this.password,
    });

    if (!data.username) {
      throw new Error("DAS 登录接口返回异常");
    }
  }

  async fetchDashboardData(): Promise<DashboardData> {
    const [site, robot, customer, project] = await Promise.all([
      this.getJson<SiteStatsResponse>("/api/site-stats", { lite: "1" }),
      this.getJson<RobotStatsResponse>("/api/robot-stats"),
      this.getJson<CustomerStatsResponse>("/api/customer-stats", { lite: "1" }),
      this.getJson<ProjectStatsResponse>("/api/project-stats", { lite: "1" }),
    ]);

    return { site, robot, customer, project };
  }

  async fetchOperationsReport(range: DateRange): Promise<OperationsReport> {
    return this.getJson<OperationsReport>("/api/stat-reports", {
      start_at: range.startAt,
      end_at: range.endAt,
    });
  }

  async fetchBusinessStats(): Promise<BusinessStatsResponse> {
    return this.getJson<BusinessStatsResponse>("/api/business-stats");
  }

  async fetchCustomerComplaints(range: DateRange): Promise<CustomerComplaintsResponse> {
    return this.getJson<CustomerComplaintsResponse>("/api/customer-complaints", {
      start_at: range.startAt,
      end_at: range.endAt,
    });
  }

  async fetchProjectStats(): Promise<ProjectStatsResponse> {
    return this.getJson<ProjectStatsResponse>("/api/project-stats");
  }

  async fetchInspectionStats(range: DateRange): Promise<InspectionStatsResponse> {
    return this.getJson<InspectionStatsResponse>("/api/inspection-stats", {
      start_at: range.startAt,
      end_at: range.endAt,
    });
  }

  async fetchCleaningAnomalies(range: DateRange): Promise<CleaningAnomalyReport> {
    return this.getJson<CleaningAnomalyReport>(
      "/api/stat-reports/cleaning-area-anomalies",
      {
        start_at: range.startAt,
        end_at: range.endAt,
      },
    );
  }

  async fetchTodoStats(range: DateRange): Promise<TodoStatsResponse> {
    return this.getJson<TodoStatsResponse>("/api/todo-stats", {
      start_at: range.startAt,
      end_at: range.endAt,
    });
  }

  async fetchTodoList(range: DateRange): Promise<TodoListResponse> {
    return this.getJson<TodoListResponse>("/api/todo-list", {
      start_at: range.startAt,
      end_at: range.endAt,
    });
  }

  async fetchFieldTodos(): Promise<FieldTodosResponse> {
    return this.getJson<FieldTodosResponse>("/api/field-todos");
  }

  async fetchCleaningQuality(range: DateRange): Promise<CleaningQualityResponse> {
    return this.getJson<CleaningQualityResponse>("/api/cleaning-quality", {
      start_at: range.startAt,
      end_at: range.endAt,
    });
  }

  async fetchPowerBoost(range: DateRange): Promise<PowerBoostResponse> {
    return this.getJson<PowerBoostResponse>("/api/site-power-boost", {
      start_at: range.startAt,
      end_at: range.endAt,
    });
  }

  private async getJson<T>(
    path: string,
    query?: Record<string, string | number>,
  ): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      params.set(key, String(value));
    }

    const suffix = params.size ? `?${params.toString()}` : "";
    return this.requestJson<T>(`${path}${suffix}`);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    return this.requestJson<T>(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), init);
    if (!response.ok) {
      throw new Error(`DAS 请求失败: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as JsonEnvelope<T>;
    if (payload.code !== "000000") {
      throw new Error(payload.message ?? "DAS 返回失败");
    }

    return payload.data;
  }
}
