import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type JobState = {
  lastPlatformRobotCount?: number;
  lastPeriodLabel?: string;
  updatedAt?: string;
};

type StateShape = {
  jobs: Record<string, JobState>;
};

const DEFAULT_STATE: StateShape = {
  jobs: {},
};

export class ReportStateStore {
  constructor(private readonly filePath: string) {}

  getJobState(jobName: string): JobState {
    const state = this.read();
    return state.jobs[jobName] ?? {};
  }

  updateJobState(jobName: string, nextState: JobState): void {
    const state = this.read();
    state.jobs[jobName] = {
      ...state.jobs[jobName],
      ...nextState,
    };
    this.write(state);
  }

  private read(): StateShape {
    const absolutePath = resolve(this.filePath);
    if (!existsSync(absolutePath)) {
      return structuredClone(DEFAULT_STATE);
    }

    try {
      const raw = readFileSync(absolutePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StateShape>;
      return {
        jobs: parsed.jobs ?? {},
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  private write(state: StateShape): void {
    const absolutePath = resolve(this.filePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, JSON.stringify(state, null, 2));
  }
}
