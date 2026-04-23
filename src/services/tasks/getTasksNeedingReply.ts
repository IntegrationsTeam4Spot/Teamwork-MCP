import logger from "../../utils/logger.js";
import config from "../../utils/config.js";
import { ensureApiClient } from "../core/apiClient.js";
import getTaskById from "./getTaskById.js";

export interface GetTasksNeedingReplyParams {
  sinceHours?: number;
  excludedUserId?: number;
  excludeUserId?: number;
  excludeuserid?: number;
  excludeduserid?: number;
  commentedAfterHours?: number;
  commentedAfter?: string;
  projectIds?: number[];
  projectId?: number;
  projectid?: number;
  projectids?: number[];
  pageSize?: number;
  pagesize?: number;
  maxPages?: number;
  maxpages?: number;
  maxTasks?: number;
  maxtasks?: number;
}

interface CommentLite {
  id: number | null;
  taskId: number | null;
  projectId: number | null;
  authorId: number | null;
  authorName: string | null;
  content: string | null;
  createdAt: string | null;
  sortTime: number;
}

interface TaskSummary {
  id: number;
  name: string | null;
  status: string | null;
  projectId: number | null;
  projectName: string | null;
  taskLink: string | null;
  latestComment: {
    id: number | null;
    authorId: number | null;
    authorName: string | null;
    createdAt: string | null;
    contentPreview: string | null;
  };
}

const DEFAULT_SINCE_HOURS = 48;
const DEFAULT_EXCLUDED_USER_ID = 364769;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_TASKS = 200;

function toInt(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function toDateMs(value: any): number {
  if (typeof value !== "string" || !value.trim()) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseHours(value: any): number | null {
  const direct = toInt(value);
  if (direct !== null) {
    return direct;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(h|hr|hrs|hour|hours)?$/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function toText(value: any): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDomain(domain: string | undefined): string | null {
  if (!domain) {
    return null;
  }
  const trimmed = domain.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/\.teamwork\.com$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return `https://${trimmed}.teamwork.com`;
}

function taskLink(taskId: number): string | null {
  const base = normalizeDomain(config.domain);
  if (!base) {
    return null;
  }
  return `${base}/app/tasks/${taskId}`;
}

function pickTaskId(comment: any): number | null {
  return (
    toInt(comment?.taskId) ??
    toInt(comment?.objectId) ??
    toInt(comment?.itemId) ??
    toInt(comment?.task?.id) ??
    toInt(comment?.object?.id) ??
    null
  );
}

function pickProjectId(comment: any): number | null {
  return (
    toInt(comment?.projectId) ??
    toInt(comment?.project?.id) ??
    toInt(comment?.task?.projectId) ??
    toInt(comment?.task?.project?.id) ??
    null
  );
}

function pickAuthorId(comment: any): number | null {
  return (
    toInt(comment?.authorId) ??
    toInt(comment?.userId) ??
    toInt(comment?.createdBy) ??
    toInt(comment?.personId) ??
    toInt(comment?.user?.id) ??
    null
  );
}

function pickAuthorName(comment: any): string | null {
  const combinedName = [toText(comment?.user?.firstName), toText(comment?.user?.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    toText(comment?.authorName) ??
    toText(comment?.user?.name) ??
    (combinedName.length > 0 ? combinedName : null)
  );
}

function pickCommentTime(comment: any): string | null {
  return (
    toText(comment?.updatedAt) ??
    toText(comment?.dateUpdated) ??
    toText(comment?.createdAt) ??
    toText(comment?.dateCreated) ??
    null
  );
}

function pickCommentContent(comment: any): string | null {
  return (
    toText(comment?.content) ??
    toText(comment?.body) ??
    toText(comment?.comment) ??
    toText(comment?.text) ??
    null
  );
}

function isTaskComment(comment: any): boolean {
  const objectType = String(comment?.objectType ?? comment?.itemType ?? "").toLowerCase();
  if (!objectType) {
    return true;
  }
  return objectType.includes("task");
}

function toPreview(content: string | null): string | null {
  if (!content) {
    return null;
  }
  return content.length > 180 ? `${content.slice(0, 177)}...` : content;
}

function extractComments(responseData: any): any[] {
  if (Array.isArray(responseData)) {
    return responseData;
  }
  if (Array.isArray(responseData?.comments)) {
    return responseData.comments;
  }
  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }
  return [];
}

async function fetchCommentsPage(
  page: number,
  pageSize: number,
  updatedAfterIso: string,
  projectIds?: number[]
): Promise<any> {
  const api = ensureApiClient();
  const baseParams: Record<string, any> = {
    page,
    pageSize,
    updatedAfter: updatedAfterIso,
    orderBy: "date",
    orderMode: "desc"
  };

  if (projectIds && projectIds.length > 0) {
    baseParams.projectIds = projectIds;
  }

  const paramCandidates: Record<string, any>[] = [
    { ...baseParams, objectTypes: ["tasks"] },
    { ...baseParams, objectTypes: ["task"] },
    baseParams
  ];

  let lastError: any;
  for (const params of paramCandidates) {
    try {
      const response = await api.get("/comments.json", { params });
      return response.data;
    } catch (error: any) {
      lastError = error;
      logger.warn(`Comments query attempt failed for params ${JSON.stringify(params)}: ${error.message}`);
    }
  }

  throw lastError ?? new Error("Failed to fetch comments");
}

function extractProjectIdFromTask(task: any): number | null {
  return toInt(task?.projectId) ?? toInt(task?.project?.id) ?? null;
}

function extractProjectNameFromTask(task: any): string | null {
  return toText(task?.projectName) ?? toText(task?.project?.name) ?? null;
}

function extractTaskName(task: any): string | null {
  return toText(task?.name) ?? null;
}

function extractTaskStatus(task: any): string | null {
  if (typeof task?.status === "string" && task.status.trim()) {
    return task.status.trim();
  }
  return toText(task?.taskStatus);
}

async function fetchTaskSummary(taskId: number): Promise<{
  id: number;
  name: string | null;
  status: string | null;
  projectId: number | null;
  projectName: string | null;
}> {
  const response = await getTaskById(String(taskId));
  const task = response?.task ?? response;
  return {
    id: taskId,
    name: extractTaskName(task),
    status: extractTaskStatus(task),
    projectId: extractProjectIdFromTask(task),
    projectName: extractProjectNameFromTask(task)
  };
}

export async function getTasksNeedingReply(
  params: GetTasksNeedingReplyParams = {}
): Promise<{
  sinceHours: number;
  excludedUserId: number;
  scannedComments: number;
  candidateTaskCount: number;
  filteredOutByProject: number;
  filteredOutByTime: number;
  filteredOutByExcludedUser: number;
  tasks: TaskSummary[];
}> {
  const sinceHours = Math.max(
    1,
    Math.trunc(
      parseHours(params.sinceHours) ??
      parseHours(params.commentedAfterHours) ??
      parseHours(params.commentedAfter) ??
      DEFAULT_SINCE_HOURS
    )
  );
  const excludedUserId = Math.trunc(
    params.excludedUserId ??
    params.excludeUserId ??
    params.excludeuserid ??
    params.excludeduserid ??
    DEFAULT_EXCLUDED_USER_ID
  );
  const pageSize = Math.max(1, Math.min(500, Math.trunc(params.pageSize ?? params.pagesize ?? DEFAULT_PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(100, Math.trunc(params.maxPages ?? params.maxpages ?? DEFAULT_MAX_PAGES)));
  const maxTasks = Math.max(1, Math.min(1000, Math.trunc(params.maxTasks ?? params.maxtasks ?? DEFAULT_MAX_TASKS)));
  const rawProjectIds = [
    ...(params.projectIds ?? params.projectids ?? []),
    ...(params.projectId !== undefined ? [params.projectId] : []),
    ...(params.projectid !== undefined ? [params.projectid] : [])
  ];
  const projectIds = rawProjectIds
    .map((value) => toInt(value))
    .filter((value): value is number => value !== null);
  const cutoffMs = Date.now() - sinceHours * 60 * 60 * 1000;
  const updatedAfterIso = new Date(cutoffMs).toISOString();

  const latestByTask = new Map<number, CommentLite>();
  let scannedComments = 0;
  let filteredOutByTime = 0;
  let filteredOutByExcludedUser = 0;
  let filteredOutByProject = 0;

  for (let page = 1; page <= maxPages; page++) {
    const pageData = await fetchCommentsPage(page, pageSize, updatedAfterIso, projectIds);
    const comments = extractComments(pageData);
    if (comments.length === 0) {
      break;
    }

    for (const comment of comments) {
      if (!isTaskComment(comment)) {
        continue;
      }
      const taskId = pickTaskId(comment);
      if (taskId === null) {
        continue;
      }

      const createdAt = pickCommentTime(comment);
      const sortTime = toDateMs(createdAt);
      const candidate: CommentLite = {
        id: toInt(comment?.id),
        taskId,
        projectId: pickProjectId(comment),
        authorId: pickAuthorId(comment),
        authorName: pickAuthorName(comment),
        content: pickCommentContent(comment),
        createdAt,
        sortTime
      };

      if (candidate.sortTime > 0 && candidate.sortTime < cutoffMs) {
        filteredOutByTime += 1;
        continue;
      }

      if (projectIds.length > 0 && candidate.projectId !== null && !projectIds.includes(candidate.projectId)) {
        filteredOutByProject += 1;
        continue;
      }

      const existing = latestByTask.get(taskId);
      if (!existing || candidate.sortTime >= existing.sortTime) {
        latestByTask.set(taskId, candidate);
      }
      scannedComments += 1;
    }

    if (comments.length < pageSize) {
      break;
    }
  }

  const sortedCandidateComments = [...latestByTask.values()]
    .sort((a, b) => b.sortTime - a.sortTime);

  const candidateComments = sortedCandidateComments.filter((entry) => {
    const include = entry.authorId !== excludedUserId;
    if (!include) {
      filteredOutByExcludedUser += 1;
    }
    return include;
  });

  const tasks: TaskSummary[] = [];
  for (const comment of candidateComments) {
    if (tasks.length >= maxTasks) {
      break;
    }
    if (comment.taskId === null) {
      continue;
    }

    let summary: Awaited<ReturnType<typeof fetchTaskSummary>> | null = null;
    try {
      summary = await fetchTaskSummary(comment.taskId);
    } catch (error: any) {
      logger.warn(`Unable to load task ${comment.taskId} details: ${error.message}`);
      summary = {
        id: comment.taskId,
        name: null,
        status: null,
        projectId: null,
        projectName: null
      };
    }

    if (projectIds.length > 0) {
      const taskProjectId = summary.projectId;
      if (taskProjectId === null || !projectIds.includes(taskProjectId)) {
        filteredOutByProject += 1;
        continue;
      }
    }

    tasks.push({
      id: summary.id,
      name: summary.name,
      status: summary.status,
      projectId: summary.projectId,
      projectName: summary.projectName,
      taskLink: taskLink(summary.id),
      latestComment: {
        id: comment.id,
        authorId: comment.authorId,
        authorName: comment.authorName,
        createdAt: comment.createdAt,
        contentPreview: toPreview(comment.content)
      }
    });
  }

  return {
    sinceHours,
    excludedUserId,
    scannedComments,
    candidateTaskCount: tasks.length,
    filteredOutByProject,
    filteredOutByTime,
    filteredOutByExcludedUser,
    tasks
  };
}

export default getTasksNeedingReply;
