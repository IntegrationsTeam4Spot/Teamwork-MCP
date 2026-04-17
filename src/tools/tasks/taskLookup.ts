import logger from "../../utils/logger.js";
import { getApiClientForVersion } from "../../services/core/apiClient.js";

type RecordMap = Record<string, any>;

interface ProjectLookupData {
  projectName?: string;
  workflowsById: RecordMap;
  stagesById: RecordMap;
}

interface ResolvedWorkflowStage {
  projectId: number;
  workflowId?: number;
  workflowName?: string;
  stageId?: number;
  stageName?: string;
}

const projectLookupCache = new Map<number, Promise<ProjectLookupData>>();
const tasklistLookupCache = new Map<number, Promise<{ tasklist?: any; project?: any }>>();
const tagLookupCache = new Map<number, Promise<any | undefined>>();

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
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    return (
      toId((value as any).id) ??
      toId((value as any).ID) ??
      toId((value as any).value)
    );
  }

  return undefined;
}

function getById(map: RecordMap, id?: number): any {
  if (!id) {
    return undefined;
  }
  return map[String(id)] ?? map[id];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function stageDisplayName(stage: any): string | undefined {
  if (typeof stage?.name === "string" && stage.name.trim()) {
    return stage.name.trim();
  }
  if (typeof stage?.stage === "string" && stage.stage.trim()) {
    return stage.stage.trim();
  }
  return undefined;
}

function extractTasks(payload: any): any[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.tasks)) {
    return payload.tasks;
  }

  if (payload.task && typeof payload.task === "object") {
    return [payload.task];
  }

  return [];
}

function clonePayloadWithTasks(payload: any): { result: any; tasks: any[] } {
  if (!payload || typeof payload !== "object") {
    return { result: payload, tasks: [] };
  }

  if (Array.isArray(payload.tasks)) {
    const clonedTasks = payload.tasks.map((task: any) => ({ ...task }));
    return {
      result: { ...payload, tasks: clonedTasks },
      tasks: clonedTasks
    };
  }

  if (payload.task && typeof payload.task === "object") {
    const clonedTask = { ...payload.task };
    return {
      result: { ...payload, task: clonedTask },
      tasks: [clonedTask]
    };
  }

  return { result: payload, tasks: [] };
}

function collectTaskIds(tasks: any[]): number[] {
  const ids = new Set<number>();
  for (const task of tasks) {
    const taskId = toId(task?.id);
    if (taskId) {
      ids.add(taskId);
    }
  }
  return Array.from(ids);
}

function collectTagIds(task: any): number[] {
  const ids = new Set<number>();

  if (Array.isArray(task?.tagIds)) {
    for (const tagId of task.tagIds) {
      const parsedId = toId(tagId);
      if (parsedId) {
        ids.add(parsedId);
      }
    }
  }

  if (Array.isArray(task?.tags)) {
    for (const tagRelationship of task.tags) {
      const parsedId = toId(tagRelationship);
      if (parsedId) {
        ids.add(parsedId);
      }
    }
  }

  return Array.from(ids);
}

function extractWorkflowStage(task: any): { workflowId?: number; stageId?: number } {
  let workflowId = toId(task?.workflowId) ?? toId(task?.workflow);
  let stageId = toId(task?.stageId) ?? toId(task?.stage);

  if (Array.isArray(task?.workflowStages) && task.workflowStages.length > 0) {
    const firstStage = task.workflowStages[0];
    workflowId = toId(firstStage?.workflowId) ?? toId(firstStage?.workflow) ?? workflowId;
    stageId = toId(firstStage?.stageId) ?? toId(firstStage?.stage) ?? stageId;
  }

  return { workflowId, stageId };
}

function tasklistIdFromTask(task: any): number | undefined {
  return toId(task?.tasklistId) ?? toId(task?.tasklist);
}

function projectIdFromTask(task: any): number | undefined {
  return toId(task?.projectId) ?? toId(task?.project);
}

function projectIdForTask(task: any, tasklistsById: RecordMap): number | undefined {
  const directProjectId = projectIdFromTask(task);
  if (directProjectId) {
    return directProjectId;
  }

  const tasklistId = tasklistIdFromTask(task);
  if (!tasklistId) {
    return undefined;
  }

  const tasklist = getById(tasklistsById, tasklistId);
  return toId(tasklist?.projectId) ?? toId(tasklist?.project);
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function fetchTaskLookupBundle(taskIds: number[]): Promise<{ tasksById: RecordMap; included: RecordMap }> {
  if (taskIds.length === 0) {
    return { tasksById: {}, included: {} };
  }

  const apiClient = getApiClientForVersion();
  const tasksById: RecordMap = {};
  const mergedIncluded: RecordMap = {};
  const chunkSize = 50;

  for (let index = 0; index < taskIds.length; index += chunkSize) {
    const chunk = taskIds.slice(index, index + chunkSize);

    try {
      const response = await apiClient.get("/tasks.json", {
        params: {
          ids: chunk,
          include: ["projects", "tasklists", "tags"],
          "fields[tasklists]": ["id", "name", "projectId"],
          "fields[projects]": ["id", "name"],
          "fields[tags]": ["id", "name"]
        }
      });

      const payload = response?.data ?? {};
      for (const task of ensureArray<any>(payload.tasks)) {
        const taskId = toId(task?.id);
        if (taskId) {
          tasksById[String(taskId)] = task;
        }
      }

      const included = asRecord(payload.included);
      for (const [key, value] of Object.entries(included)) {
        if (!mergedIncluded[key]) {
          mergedIncluded[key] = {};
        }
        mergeMaps(mergedIncluded[key], value);
      }
    } catch (error: any) {
      logger.warn(`Failed to load supplemental task lookup data for chunk: ${error.message}`);
    }
  }

  return { tasksById, included: mergedIncluded };
}

async function fetchProjectLookupData(projectId: number): Promise<ProjectLookupData> {
  if (!projectLookupCache.has(projectId)) {
    const promise = (async () => {
      const apiClient = getApiClientForVersion();
      const baseParams = {
        "fields[projects]": ["id", "name"],
        "fields[workflows]": ["id", "name", "statusId"],
        "fields[stages]": ["id", "name", "stage", "workflowId"]
      };
      const requestParams = [
        { ...baseParams, include: ["workflows", "stages", "workflowStages"] },
        baseParams
      ];

      for (const params of requestParams) {
        try {
          const response = await apiClient.get(`/projects/${projectId}.json`, { params });
          const payload = response?.data ?? {};
          const included = asRecord(payload.included);

          const workflowsById: RecordMap = {};
          const stagesById: RecordMap = {};

          mergeMaps(workflowsById, included.workflows);
          mergeMaps(stagesById, included.stages);
          mergeMaps(stagesById, included.workflowStages);

          const projectName =
            typeof payload?.project?.name === "string" && payload.project.name.trim()
              ? payload.project.name.trim()
              : undefined;

          return {
            projectName,
            workflowsById,
            stagesById
          };
        } catch (error: any) {
          logger.warn(`Failed to load project lookup data for project ${projectId}: ${error.message}`);
        }
      }

      return {
        workflowsById: {},
        stagesById: {}
      };
    })();

    projectLookupCache.set(projectId, promise);
  }

  return projectLookupCache.get(projectId)!;
}

async function fetchTasklistLookupData(tasklistId: number): Promise<{ tasklist?: any; project?: any }> {
  if (!tasklistLookupCache.has(tasklistId)) {
    const promise = (async () => {
      const apiClient = getApiClientForVersion();
      const requests = [
        () => apiClient.get(`/tasklists/${tasklistId}`, {
          params: {
            include: ["projects"],
            "fields[tasklists]": ["id", "name", "projectId"],
            "fields[projects]": ["id", "name"]
          }
        }),
        () => apiClient.get(`/tasklists/${tasklistId}.json`, {
          params: {
            include: ["projects"],
            "fields[tasklists]": ["id", "name", "projectId"],
            "fields[projects]": ["id", "name"]
          }
        })
      ];

      for (const request of requests) {
        try {
          const response = await request();
          const payload = response?.data ?? {};
          const tasklist = payload?.tasklist ?? getById(asRecord(payload?.included?.tasklists), tasklistId);
          const projectId = toId(tasklist?.projectId) ?? toId(tasklist?.project);
          const project = projectId ? getById(asRecord(payload?.included?.projects), projectId) : undefined;
          return { tasklist, project };
        } catch (_error) {
          // Try next fallback URL.
        }
      }

      return {};
    })();

    tasklistLookupCache.set(tasklistId, promise);
  }

  return tasklistLookupCache.get(tasklistId)!;
}

async function fetchTagById(tagId: number): Promise<any | undefined> {
  if (!tagLookupCache.has(tagId)) {
    const promise = (async () => {
      const apiClient = getApiClientForVersion();
      try {
        const response = await apiClient.get(`/tags/${tagId}.json`, {
          params: {
            "fields[tags]": ["id", "name", "color", "count"]
          }
        });

        const payload = response?.data ?? {};
        return payload?.tag ?? getById(asRecord(payload?.included?.tags), tagId);
      } catch (error: any) {
        logger.warn(`Failed to resolve tag ${tagId}: ${error.message}`);
        return undefined;
      }
    })();

    tagLookupCache.set(tagId, promise);
  }

  return tagLookupCache.get(tagId)!;
}

function stageWorkflowId(stage: any): number | undefined {
  return toId(stage?.workflowId) ?? toId(stage?.workflow);
}

async function fetchTaskForLookup(taskId: number): Promise<{ task?: any; included: RecordMap }> {
  const apiClient = getApiClientForVersion();
  const taskPathAttempts = [`/tasks/${taskId}.json`, `/tasks/${taskId}`];
  const taskParams = {
    include: ["tasklists"],
    "fields[tasklists]": ["id", "projectId", "name"]
  };

  for (const path of taskPathAttempts) {
    try {
      const response = await apiClient.get(path, { params: taskParams });
      const payload = response?.data ?? {};
      const task =
        payload?.task ??
        ensureArray<any>(payload?.tasks).find((item: any) => toId(item?.id) === taskId);

      if (task) {
        return { task, included: asRecord(payload?.included) };
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        continue;
      }
      logger.warn(`Failed loading task ${taskId} from ${path}: ${error.message}`);
    }
  }

  const listAttempts: Array<{ ids: string | number[] }> = [
    { ids: [taskId] },
    { ids: String(taskId) }
  ];

  for (const params of listAttempts) {
    try {
      const response = await apiClient.get("/tasks.json", {
        params: {
          ...params,
          include: ["tasklists"],
          "fields[tasklists]": ["id", "projectId", "name"]
        }
      });

      const payload = response?.data ?? {};
      const task = ensureArray<any>(payload?.tasks).find((item: any) => toId(item?.id) === taskId);
      if (task) {
        return { task, included: asRecord(payload?.included) };
      }
    } catch (error: any) {
      logger.warn(`Failed loading task ${taskId} from /tasks.json: ${error.message}`);
    }
  }

  return { included: {} };
}

export async function enrichTaskLookupValues(payload: any): Promise<any> {
  const { result, tasks } = clonePayloadWithTasks(payload);
  if (tasks.length === 0) {
    return payload;
  }

  const included = asRecord(result?.included);

  const projectsById: RecordMap = {};
  const tasklistsById: RecordMap = {};
  const tagsById: RecordMap = {};
  const workflowsById: RecordMap = {};
  const stagesById: RecordMap = {};

  mergeMaps(projectsById, included.projects);
  mergeMaps(tasklistsById, included.tasklists);
  mergeMaps(tagsById, included.tags);
  mergeMaps(workflowsById, included.workflows);
  mergeMaps(stagesById, included.stages);
  mergeMaps(stagesById, included.workflowStages);

  const taskIds = collectTaskIds(tasks);
  const shouldFetchSupplemental =
    Object.keys(projectsById).length === 0 ||
    Object.keys(tasklistsById).length === 0 ||
    Object.keys(tagsById).length === 0;

  if (shouldFetchSupplemental && taskIds.length > 0) {
    const supplemental = await fetchTaskLookupBundle(taskIds);
    mergeMaps(projectsById, supplemental.included.projects);
    mergeMaps(tasklistsById, supplemental.included.tasklists);
    mergeMaps(tagsById, supplemental.included.tags);

    for (const task of tasks) {
      const taskId = toId(task?.id);
      if (!taskId) {
        continue;
      }

      const supplementalTask = supplemental.tasksById[String(taskId)];
      if (!supplementalTask) {
        continue;
      }

      if (task.tasklistId === undefined && supplementalTask.tasklistId !== undefined) {
        task.tasklistId = supplementalTask.tasklistId;
      }

      if (!Array.isArray(task.tagIds) && Array.isArray(supplementalTask.tagIds)) {
        task.tagIds = supplementalTask.tagIds;
      }
    }
  }

  const unresolvedTasklistIds = new Set<number>();
  for (const task of tasks) {
    const tasklistId = tasklistIdFromTask(task);
    if (tasklistId && !getById(tasklistsById, tasklistId)) {
      unresolvedTasklistIds.add(tasklistId);
    }
  }

  if (unresolvedTasklistIds.size > 0) {
    const tasklistLookups = await Promise.all(
      Array.from(unresolvedTasklistIds).map(async (tasklistId) => [tasklistId, await fetchTasklistLookupData(tasklistId)] as const)
    );

    for (const [tasklistId, lookup] of tasklistLookups) {
      if (lookup.tasklist) {
        tasklistsById[String(tasklistId)] = lookup.tasklist;
      }

      const projectId = toId(lookup.tasklist?.projectId) ?? toId(lookup.tasklist?.project);
      if (projectId && lookup.project) {
        projectsById[String(projectId)] = lookup.project;
      }
    }
  }

  const unresolvedTagIds = new Set<number>();
  for (const task of tasks) {
    for (const tagId of collectTagIds(task)) {
      if (!getById(tagsById, tagId)) {
        unresolvedTagIds.add(tagId);
      }
    }
  }

  if (unresolvedTagIds.size > 0) {
    const resolvedTags = await Promise.all(
      Array.from(unresolvedTagIds).map(async (tagId) => [tagId, await fetchTagById(tagId)] as const)
    );

    for (const [tagId, tag] of resolvedTags) {
      if (tag) {
        tagsById[String(tagId)] = tag;
      }
    }
  }

  const projectIds = new Set<number>();
  for (const task of tasks) {
    const projectId = projectIdForTask(task, tasklistsById);
    if (projectId) {
      projectIds.add(projectId);
    }
  }

  const projectLookupEntries = await Promise.all(
    Array.from(projectIds).map(async (projectId) => [projectId, await fetchProjectLookupData(projectId)] as const)
  );
  const projectLookupById = new Map<number, ProjectLookupData>(projectLookupEntries);

  for (const [projectId, lookup] of projectLookupEntries) {
    if (lookup.projectName && !getById(projectsById, projectId)) {
      projectsById[String(projectId)] = { id: projectId, name: lookup.projectName };
    }
    mergeMaps(workflowsById, lookup.workflowsById);
    mergeMaps(stagesById, lookup.stagesById);
  }

  for (const task of tasks) {
    const tasklistId = tasklistIdFromTask(task);
    const tasklist = getById(tasklistsById, tasklistId);

    const projectId = projectIdForTask(task, tasklistsById);
    const project = getById(projectsById, projectId);
    const projectLookup = projectId ? projectLookupById.get(projectId) : undefined;

    const tagIds = collectTagIds(task);
    const tagNames = Array.from(
      new Set(
        tagIds
          .map((tagId) => {
            const tag = getById(tagsById, tagId);
            return typeof tag?.name === "string" ? tag.name : undefined;
          })
          .filter((name): name is string => !!name)
      )
    );

    let { workflowId, stageId } = extractWorkflowStage(task);

    let stage = getById(stagesById, stageId);
    if (!stage && projectLookup) {
      stage = getById(projectLookup.stagesById, stageId);
    }

    if (!workflowId && stage) {
      workflowId = stageWorkflowId(stage);
    }

    let workflow = getById(workflowsById, workflowId);
    if (!workflow && projectLookup) {
      workflow = getById(projectLookup.workflowsById, workflowId);
    }

    const lookup = {
      projectName:
        (typeof project?.name === "string" ? project.name : undefined) ??
        projectLookup?.projectName ??
        null,
      tasklistName: typeof tasklist?.name === "string" ? tasklist.name : null,
      tagNames,
      workflowName: typeof workflow?.name === "string" ? workflow.name : null,
      stageName: stageDisplayName(stage) ?? null
    };

    (task as any).lookup = lookup;
    (task as any).projectName = lookup.projectName;
    (task as any).tasklistName = lookup.tasklistName;
    (task as any).taskListName = lookup.tasklistName;
    (task as any).tagNames = lookup.tagNames;
    (task as any).workflowName = lookup.workflowName;
    (task as any).stageName = lookup.stageName;
    (task as any).stageLabel = lookup.stageName;
  }

  return result;
}

async function resolveWorkflowStageIdsForProject(
  projectId: number,
  workflowNameInput?: string,
  stageNameInput?: string
): Promise<ResolvedWorkflowStage> {
  const lookup = await fetchProjectLookupData(projectId);
  const workflows = Object.values(lookup.workflowsById);
  const stages = Object.values(lookup.stagesById);

  const workflowName = workflowNameInput?.trim();
  const stageName = stageNameInput?.trim();

  let resolvedWorkflowId: number | undefined;
  let resolvedWorkflowName: string | undefined;
  let resolvedStageId: number | undefined;
  let resolvedStageName: string | undefined;

  if (workflowName) {
    const matches = workflows.filter((workflow: any) => normalizeName(String(workflow?.name ?? "")) === normalizeName(workflowName));
    if (matches.length === 0) {
      const available = workflows
        .map((workflow: any) => workflow?.name)
        .filter((name: any) => typeof name === "string")
        .join(", ");
      throw new Error(
        available
          ? `Workflow '${workflowName}' was not found in project ${projectId}. Available workflows: ${available}`
          : `Workflow '${workflowName}' was not found in project ${projectId}.`
      );
    }

    const workflow = matches[0];
    resolvedWorkflowId = toId(workflow?.id);
    resolvedWorkflowName = typeof workflow?.name === "string" ? workflow.name : undefined;
  }

  if (stageName) {
    let stageMatches = stages.filter((stage: any) => normalizeName(String(stageDisplayName(stage) ?? "")) === normalizeName(stageName));

    if (resolvedWorkflowId) {
      stageMatches = stageMatches.filter((stage: any) => stageWorkflowId(stage) === resolvedWorkflowId);
    }

    if (stageMatches.length === 0) {
      const available = stages
        .map((stage: any) => stageDisplayName(stage))
        .filter((name: any) => typeof name === "string")
        .join(", ");
      throw new Error(
        available
          ? `Stage '${stageName}' was not found in project ${projectId}. Available stages: ${available}`
          : `Stage '${stageName}' was not found in project ${projectId}.`
      );
    }

    if (!resolvedWorkflowId && stageMatches.length > 1) {
      throw new Error(`Stage '${stageName}' is not unique in project ${projectId}. Please also provide workflowName.`);
    }

    const stage = stageMatches[0];
    resolvedStageId = toId(stage?.id);
    resolvedStageName = stageDisplayName(stage);

    const stageWorkflow = stageWorkflowId(stage);
    if (!resolvedWorkflowId && stageWorkflow) {
      resolvedWorkflowId = stageWorkflow;
      const resolvedWorkflow = getById(lookup.workflowsById, stageWorkflow);
      if (typeof resolvedWorkflow?.name === "string") {
        resolvedWorkflowName = resolvedWorkflow.name;
      }
    }
  }

  return {
    projectId,
    workflowId: resolvedWorkflowId,
    workflowName: resolvedWorkflowName,
    stageId: resolvedStageId,
    stageName: resolvedStageName
  };
}

export async function resolveWorkflowStageByNameForTask(
  taskId: string | number,
  workflowName?: string,
  stageName?: string
): Promise<ResolvedWorkflowStage> {
  const parsedTaskId = toId(taskId);
  if (!parsedTaskId) {
    throw new Error("A valid taskId is required to resolve workflow/stage by name.");
  }

  const { task, included } = await fetchTaskForLookup(parsedTaskId);
  if (!task) {
    throw new Error(`Task ${parsedTaskId} was not found.`);
  }

  const tasklistsById = asRecord(included?.tasklists);
  let projectId = projectIdForTask(task, tasklistsById);

  if (!projectId) {
    const tasklistId = tasklistIdFromTask(task);
    if (tasklistId) {
      const tasklistLookup = await fetchTasklistLookupData(tasklistId);
      projectId =
        toId(tasklistLookup?.tasklist?.projectId) ??
        toId(tasklistLookup?.tasklist?.project);
    }
  }

  if (!projectId) {
    throw new Error(`Unable to determine projectId for task ${parsedTaskId}.`);
  }

  return resolveWorkflowStageIdsForProject(projectId, workflowName, stageName);
}
