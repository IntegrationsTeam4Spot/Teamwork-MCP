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
  includeFullCommentContent?: boolean;
  previewLength?: number;
  previewlength?: number;
}

interface CommentLite {
  id: number | null;
  taskId: number | null;
  projectId: number | null;
  projectName?: string | null;
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
    content?: string | null;
  };
}

const DEFAULT_SINCE_HOURS = 48;
const DEFAULT_EXCLUDED_USER_ID = 364769;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_TASKS = 200;
const DEFAULT_PREVIEW_LENGTH = 180;

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
    toInt(comment?.authorUserId) ??
    toInt(comment?.creatorUserId) ??
    toInt(comment?.createdByUserId) ??
    toInt(comment?.postedByUserId) ??
    toInt(comment?.userId) ??
    toInt(comment?.createdBy) ??
    toInt(comment?.personId) ??
    toInt(comment?.creatorId) ??
    toInt(comment?.user?.id) ??
    toInt(comment?.author?.id) ??
    toInt(comment?.postedBy?.id) ??
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
    (combinedName.length > 0 ? combinedName : null) ??
    toText(comment?.postedBy?.name) ??
    toText(comment?.postedBy?.firstName) ??
    null
  );
}

function pickCommentTime(comment: any): string | null {
  return (
    toText(comment?.date) ??
    toText(comment?.postedDateTime) ??
    toText(comment?.dateLastEdited) ??
    toText(comment?.updatedAt) ??
    toText(comment?.dateUpdated) ??
    toText(comment?.createdAt) ??
    toText(comment?.dateCreated) ??
    toText(comment?.postedAt) ??
    toText(comment?.postedOn) ??
    toText(comment?.createdOn) ??
    toText(comment?.dateTime) ??
    toText(comment?.datetime) ??
    toText(comment?.createdDate) ??
    null
  );
}

function pickCommentContent(comment: any): string | null {
  return (
    toText(comment?.content) ??
    toText(comment?.body) ??
    toText(comment?.htmlBody) ??
    toText(comment?.comment) ??
    toText(comment?.text) ??
    null
  );
}

function isTaskComment(comment: any): boolean {
  const objectType = String(comment?.objectType ?? comment?.itemType ?? "").toLowerCase();
  const taskId = pickTaskId(comment);
  if (!objectType) {
    return taskId !== null;
  }
  return objectType.includes("task");
}

function toPreview(content: string | null, previewLength: number): string | null {
  if (!content) {
    return null;
  }
  return content.length > previewLength
    ? `${content.slice(0, Math.max(0, previewLength - 3))}...`
    : content;
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

function toCsv(values: number[]): string | undefined {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  const parsed = values
    .map((value) => toInt(value))
    .filter((value): value is number => value !== null);
  return parsed.length > 0 ? parsed.join(",") : undefined;
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
    orderMode: "desc",
    include: "users,tasks,projects"
  };

  const projectIdsCsv = toCsv(projectIds ?? []);
  if (projectIdsCsv) {
    baseParams.projectIds = projectIdsCsv;
  }

  const paramCandidates: Record<string, any>[] = [
    { ...baseParams, objectTypes: "task" },
    { ...baseParams, objectType: "task" },
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
  return (
    toInt(task?.projectId) ??
    toInt(task?.project?.id) ??
    toInt(task?.project?.projectId) ??
    toInt(task?.project?.value) ??
    toInt(task?.tasklist?.projectId) ??
    null
  );
}

function extractProjectNameFromTask(task: any): string | null {
  return (
    toText(task?.projectName) ??
    toText(task?.project?.name) ??
    toText(task?.tasklist?.projectName) ??
    null
  );
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
  excludedUserId: number | null;
  projectIdsApplied: number[];
  includeFullCommentContent: boolean;
  previewLength: number;
  pagesScanned: number;
  rawCommentsFetched: number;
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
  const excludedInput =
    params.excludedUserId ??
    params.excludeUserId ??
    params.excludeuserid ??
    params.excludeduserid;
  const excludedUserIdValue = toInt(excludedInput);
  const excludedUserId =
    excludedUserIdValue !== null
      ? (excludedUserIdValue > 0 ? excludedUserIdValue : null)
      : DEFAULT_EXCLUDED_USER_ID;
  const pageSize = Math.max(1, Math.min(500, Math.trunc(params.pageSize ?? params.pagesize ?? DEFAULT_PAGE_SIZE)));
  const maxPages = Math.max(1, Math.min(100, Math.trunc(params.maxPages ?? params.maxpages ?? DEFAULT_MAX_PAGES)));
  const maxTasks = Math.max(1, Math.min(1000, Math.trunc(params.maxTasks ?? params.maxtasks ?? DEFAULT_MAX_TASKS)));
  const includeFullCommentContent = Boolean(params.includeFullCommentContent);
  const previewLength = Math.max(
    20,
    Math.min(5000, Math.trunc(params.previewLength ?? params.previewlength ?? DEFAULT_PREVIEW_LENGTH))
  );
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
  const seenCommentKeys = new Set<string>();
  let pagesScanned = 0;
  let rawCommentsFetched = 0;
  let scannedComments = 0;
  let filteredOutByTime = 0;
  let filteredOutByExcludedUser = 0;
  let filteredOutByProject = 0;

  for (let page = 1; page <= maxPages; page++) {
    const pageData = await fetchCommentsPage(page, pageSize, updatedAfterIso, projectIds);
    const comments = extractComments(pageData);
    pagesScanned += 1;
    rawCommentsFetched += comments.length;
    if (comments.length === 0) {
      break;
    }

    let newCommentsOnPage = 0;

    for (let index = 0; index < comments.length; index++) {
      const comment = comments[index];
      const commentId = toInt(comment?.id);
      const syntheticKey = `${pickTaskId(comment) ?? "na"}:${pickCommentTime(comment) ?? "na"}:${toText(
        pickCommentContent(comment)
      ) ?? "na"}:${index}`;
      const dedupeKey = commentId !== null ? `id:${commentId}` : `synthetic:${syntheticKey}`;
      if (seenCommentKeys.has(dedupeKey)) {
        continue;
      }
      seenCommentKeys.add(dedupeKey);
      newCommentsOnPage += 1;

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

    if (newCommentsOnPage === 0) {
      logger.info(`Stopping pagination at page ${page}: no new comments discovered.`);
      break;
    }
  }

  const sortedCandidateComments = [...latestByTask.values()]
    .sort((a, b) => b.sortTime - a.sortTime);

  const candidateComments = sortedCandidateComments.filter((entry) => {
    const include = excludedUserId === null ? true : entry.authorId !== excludedUserId;
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
        contentPreview: toPreview(comment.content, previewLength),
        ...(includeFullCommentContent ? { content: comment.content } : {})
      }
    });
  }

  return {
    sinceHours,
    excludedUserId,
    projectIdsApplied: projectIds,
    includeFullCommentContent,
    previewLength,
    pagesScanned,
    rawCommentsFetched,
    scannedComments,
    candidateTaskCount: tasks.length,
    filteredOutByProject,
    filteredOutByTime,
    filteredOutByExcludedUser,
    tasks
  };
}

export default getTasksNeedingReply;
