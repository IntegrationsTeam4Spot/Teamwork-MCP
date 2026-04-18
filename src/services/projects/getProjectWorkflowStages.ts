import logger from "../../utils/logger.js";
import { ensureApiClient } from "../core/apiClient.js";

type RecordMap = Record<string, any>;

export interface WorkflowStageSummary {
  id: number;
  name: string;
  workflowId?: number;
  workflowName?: string;
}

export interface WorkflowSummary {
  id: number;
  name: string;
  stages: WorkflowStageSummary[];
}

export interface ProjectWorkflowStagesResponse {
  projectId: number;
  projectName?: string;
  workflows: WorkflowSummary[];
  stages: WorkflowStageSummary[];
}

interface WorkflowLite {
  id: number;
  name: string;
}

interface StageLite {
  id: number;
  name: string;
  workflowId?: number;
}

function asRecord(value: any): RecordMap {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RecordMap;
  }
  return {};
}

function mergeMaps(target: RecordMap, source: any): void {
  for (const [key, value] of Object.entries(asRecord(source))) {
    target[String(key)] = value;
  }
}

function toId(value: any): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    return toId((value as any).id) ?? toId((value as any).value);
  }
  return undefined;
}

function normalizeName(value: any): string {
  return String(value ?? "").trim();
}

function stageDisplayName(stage: any): string {
  const name = normalizeName(stage?.name);
  if (name) {
    return name;
  }
  const label = normalizeName(stage?.stage);
  if (label) {
    return label;
  }
  return "";
}

function stageWorkflowId(stage: any): number | undefined {
  return toId(stage?.workflowId) ?? toId(stage?.workflow);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export const getProjectWorkflowStages = async (projectId: string): Promise<ProjectWorkflowStagesResponse> => {
  const parsedProjectId = toId(projectId);
  if (!parsedProjectId) {
    throw new Error("A valid projectId is required.");
  }

  const api = ensureApiClient();
  const params = {
    include: ["workflows", "stages", "workflowStages"],
    "fields[projects]": ["id", "name"],
    "fields[workflows]": ["id", "name", "statusId"],
    "fields[stages]": ["id", "name", "stage", "workflowId"],
    "fields[workflowStages]": ["id", "name", "stage", "workflowId"]
  };

  let payload: any = null;
  const paths = [`/projects/${parsedProjectId}.json`, `/projects/${parsedProjectId}`];
  let lastError: any = null;

  for (const requestPath of paths) {
    try {
      const response = await api.get(requestPath, { params });
      payload = response?.data ?? {};
      break;
    } catch (error: any) {
      lastError = error;
      logger.warn(`Failed to fetch project workflow/stage lookup from ${requestPath}: ${error.message}`);
    }
  }

  if (!payload) {
    throw new Error(
      lastError?.message
        ? `Failed to load project workflow/stage lookup: ${lastError.message}`
        : "Failed to load project workflow/stage lookup."
    );
  }

  const included = asRecord(payload?.included);
  const workflowsById: RecordMap = {};
  const stagesById: RecordMap = {};

  mergeMaps(workflowsById, included.workflows);
  mergeMaps(stagesById, included.stages);
  mergeMaps(stagesById, included.workflowStages);

  const workflows: WorkflowLite[] = Object.values(workflowsById)
    .map((workflow: any): WorkflowLite | undefined => {
      const id = toId(workflow?.id);
      const name = normalizeName(workflow?.name);
      if (!id || !name) {
        return undefined;
      }
      return { id, name };
    })
    .filter(isDefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  const stages: StageLite[] = Object.values(stagesById)
    .map((stage: any): StageLite | undefined => {
      const id = toId(stage?.id);
      const name = stageDisplayName(stage);
      if (!id || !name) {
        return undefined;
      }
      const workflowId = stageWorkflowId(stage);
      return { id, name, workflowId };
    })
    .filter(isDefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  const workflowNameById = new Map<number, string>(workflows.map((workflow) => [workflow.id, workflow.name]));
  const stagesWithWorkflow: WorkflowStageSummary[] = stages.map((stage) => ({
    ...stage,
    workflowName: stage.workflowId ? workflowNameById.get(stage.workflowId) : undefined
  }));

  const groupedStages = new Map<number, WorkflowStageSummary[]>();
  for (const stage of stagesWithWorkflow) {
    if (!stage.workflowId) {
      continue;
    }
    if (!groupedStages.has(stage.workflowId)) {
      groupedStages.set(stage.workflowId, []);
    }
    groupedStages.get(stage.workflowId)!.push(stage);
  }

  const workflowsWithStages: WorkflowSummary[] = workflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    stages: (groupedStages.get(workflow.id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
  }));

  const projectName =
    typeof payload?.project?.name === "string" && payload.project.name.trim()
      ? payload.project.name.trim()
      : undefined;

  return {
    projectId: parsedProjectId,
    projectName,
    workflows: workflowsWithStages,
    stages: stagesWithWorkflow
  };
};

export default getProjectWorkflowStages;
