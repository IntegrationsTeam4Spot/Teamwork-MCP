type RecordMap = Record<string, any>;

export type TaskCompactMode = "list" | "detail" | "write";

interface CompactTaskOptions {
  mode: TaskCompactMode;
  includeRaw?: boolean;
  includeFullDescription?: boolean;
  descriptionMaxLength?: number;
}

const DEFAULT_DESCRIPTION_PREVIEW_LENGTH = 280;

export function wantsRawOutput(input: any): boolean {
  return Boolean(input?.includeRaw ?? input?.include_raw ?? input?.verbose);
}

export function stringifyToolResponse(value: any): string {
  return JSON.stringify(removeEmpty(value));
}

function asRecord(value: any): RecordMap {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toId(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  if (value && typeof value === "object") {
    return toId(value.id) ?? toId(value.value);
  }
  return null;
}

function toText(value: any): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateText(value: any, maxLength: number): string | null {
  const text = toText(value);
  if (!text) {
    return null;
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 12)).trimEnd()} [truncated]`;
}

function uniqueNumbers(values: any[]): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => toId(value))
        .filter((value): value is number => value !== null)
    )
  );
}

function relationshipIds(values: any): number[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return uniqueNumbers(values);
}

function userRefs(task: any, relationshipKey: string, idsKey: string): Array<{ id: number; name?: string; type?: string }> {
  const refs = new Map<number, { id: number; name?: string; type?: string }>();

  for (const id of uniqueNumbers(task?.[idsKey] ?? [])) {
    refs.set(id, { id });
  }

  for (const item of Array.isArray(task?.[relationshipKey]) ? task[relationshipKey] : []) {
    const id = toId(item);
    if (id === null) {
      continue;
    }
    const firstName = toText(item?.firstName);
    const lastName = toText(item?.lastName);
    const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const name = toText(item?.name) ?? (combinedName || undefined);
    refs.set(id, removeEmpty({ id, name, type: toText(item?.type) ?? undefined }));
  }

  return Array.from(refs.values());
}

function mergeUserRefs(...groups: Array<Array<{ id: number; name?: string; type?: string }>>): Array<{ id: number; name?: string; type?: string }> {
  const refs = new Map<number, { id: number; name?: string; type?: string }>();
  for (const group of groups) {
    for (const ref of group) {
      const existing = refs.get(ref.id) ?? { id: ref.id };
      refs.set(ref.id, removeEmpty({ ...existing, ...ref }));
    }
  }
  return Array.from(refs.values());
}

function tagIds(task: any): number[] {
  return uniqueNumbers([
    ...(Array.isArray(task?.tagIds) ? task.tagIds : []),
    ...(Array.isArray(task?.tags) ? task.tags : [])
  ]);
}

function tagNames(task: any): string[] {
  const names = [
    ...(Array.isArray(task?.tagNames) ? task.tagNames : []),
    ...(Array.isArray(task?.tags) ? task.tags.map((tag: any) => tag?.name) : [])
  ]
    .map((name) => toText(name))
    .filter((name): name is string => !!name);
  return Array.from(new Set(names));
}

function extractTasks(payload: any): any[] {
  if (Array.isArray(payload?.tasks)) {
    return payload.tasks;
  }
  if (payload?.task && typeof payload.task === "object") {
    return [payload.task];
  }
  if (payload && typeof payload === "object" && payload.id !== undefined) {
    return [payload];
  }
  return [];
}

function paginationFrom(payload: any): any {
  return removeEmpty(payload?.meta?.page ?? payload?.pagination ?? payload?._mcpPagination ?? null);
}

export function compactTask(task: any, options: CompactTaskOptions): any {
  const lookup = asRecord(task?.lookup);
  const completion = asRecord(lookup.completion);
  const mode = options.mode;
  const maxDescriptionLength = options.descriptionMaxLength ?? DEFAULT_DESCRIPTION_PREVIEW_LENGTH;
  const fullDescription = mode === "detail" || options.includeFullDescription;

  const projectId = toId(task?.projectId) ?? toId(task?.project);
  const tasklistId = toId(task?.tasklistId) ?? toId(task?.tasklist);
  const stageId = toId(task?.stageId) ?? toId(task?.workflowStageId) ?? toId(task?.workflows?.stageId);
  const workflowId = toId(task?.workflowId) ?? toId(task?.workflows?.workflowId);
  const positionAfterTask = toId(task?.positionAfterTask) ?? toId(task?.workflows?.positionAfterTask);

  return removeEmpty({
    id: toId(task?.id),
    name: toText(task?.name),
    status: toText(task?.statusNormalized) ?? toText(task?.status),
    isCompleted: task?.isCompleted ?? task?.completed ?? completion.isCompleted,
    progress: task?.progress,
    priority: typeof task?.priority === "object" ? task.priority?.value ?? task.priority?.name : task?.priority,
    description: fullDescription ? task?.description ?? null : undefined,
    descriptionPreview: fullDescription ? undefined : truncateText(task?.description, maxDescriptionLength),
    project: {
      id: projectId,
      name: toText(task?.projectName) ?? toText(lookup.projectName) ?? toText(task?.project?.name)
    },
    tasklist: {
      id: tasklistId,
      name: toText(task?.tasklistName) ?? toText(task?.taskListName) ?? toText(lookup.tasklistName) ?? toText(task?.tasklist?.name)
    },
    workflow: {
      id: workflowId,
      name: toText(task?.workflowName) ?? toText(lookup.workflowName),
      stageId,
      stageName: toText(task?.stageName) ?? toText(task?.stageLabel) ?? toText(lookup.stageName),
      positionAfterTask
    },
    parentTaskId: toId(task?.parentTaskId) ?? toId(task?.parentTask),
    dates: {
      createdAt: task?.createdAt,
      updatedAt: task?.updatedAt ?? task?.dateUpdated,
      startDate: task?.startDate ?? task?.startAt,
      dueDate: task?.dueDate ?? task?.dueAt,
      completedAt: task?.completedAt ?? completion.completedAt
    },
    assignees: mergeUserRefs(
      userRefs(task, "assignees", "assigneeUserIds"),
      userRefs(task, "assigneeUsers", "assigneeUserIds")
    ),
    assigneeTeamIds: uniqueNumbers(task?.assigneeTeamIds ?? []),
    assigneeCompanyIds: uniqueNumbers(task?.assigneeCompanyIds ?? []),
    tagIds: tagIds(task),
    tagNames: tagNames(task),
    estimates: {
      minutes: task?.estimateMinutes ?? task?.estimatedMinutes,
      accumulatedMinutes: task?.accumulatedEstimatedMinutes
    },
    counts: {
      attachments: Array.isArray(task?.attachments) ? task.attachments.length : undefined,
      commentFollowers: relationshipIds(task?.commentFollowers).length || undefined,
      changeFollowers: relationshipIds(task?.changeFollowers).length || undefined,
      completeFollowers: relationshipIds(task?.completeFollowers).length || undefined
    },
    permissions: mode === "detail" ? task?.userPermissions : undefined,
    completion:
      mode === "detail"
        ? {
            source: task?.completionSource ?? completion.source,
            rawStatus: task?.statusRaw ?? completion.rawStatus,
            normalizedStatus: task?.statusNormalized ?? completion.normalizedStatus
          }
        : undefined
  });
}

export function compactTaskPayload(payload: any, options: CompactTaskOptions): any {
  const tasks = extractTasks(payload);
  const pagination = paginationFrom(payload);
  const compactedTasks = tasks.map((task) => compactTask(task, options));
  const result = payload?.task || (tasks.length === 1 && !Array.isArray(payload?.tasks))
    ? { task: compactedTasks[0] ?? null }
    : { count: compactedTasks.length, tasks: compactedTasks };

  const output = removeEmpty({
    ...result,
    pagination,
    affected: payload?.affected,
    raw: options.includeRaw ? payload : undefined
  });

  if (tasks.length === 0 && !payload?.task && !payload?.tasks) {
    return removeEmpty({
      result: payload,
      raw: options.includeRaw ? payload : undefined
    });
  }

  return output;
}

function pickCommentAuthor(comment: any): any {
  const user = comment?.user ?? comment?.author ?? comment?.postedBy ?? {};
  const firstName = toText(user?.firstName);
  const lastName = toText(user?.lastName);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return removeEmpty({
    id: toId(comment?.authorId) ?? toId(comment?.authorUserId) ?? toId(comment?.createdByUserId) ?? toId(comment?.userId) ?? toId(comment?.createdBy) ?? toId(user),
    name: toText(comment?.authorName) ?? toText(user?.name) ?? (combinedName || undefined)
  });
}

function compactComment(comment: any): any {
  return removeEmpty({
    id: toId(comment?.id),
    taskId: toId(comment?.taskId) ?? toId(comment?.objectId) ?? toId(comment?.itemId) ?? toId(comment?.task),
    objectType: toText(comment?.objectType) ?? toText(comment?.itemType),
    status: toText(comment?.status),
    author: pickCommentAuthor(comment),
    createdAt: comment?.createdAt ?? comment?.dateCreated ?? comment?.postedAt ?? comment?.postedDateTime ?? comment?.date,
    updatedAt: comment?.updatedAt ?? comment?.dateUpdated ?? comment?.dateLastEdited,
    content: comment?.content ?? comment?.body ?? comment?.htmlBody ?? comment?.comment ?? comment?.text ?? null
  });
}

export function compactCommentsPayload(payload: any, options: { includeRaw?: boolean } = {}): any {
  const comments = Array.isArray(payload?.comments)
    ? payload.comments
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
    ? payload
    : [];

  return removeEmpty({
    count: comments.length,
    comments: comments.map(compactComment),
    pagination: paginationFrom(payload),
    raw: options.includeRaw ? payload : undefined
  });
}

function compactTasklist(tasklist: any): any {
  return removeEmpty({
    id: toId(tasklist?.id),
    name: toText(tasklist?.name),
    projectId: toId(tasklist?.projectId) ?? toId(tasklist?.project),
    status: toText(tasklist?.status),
    isPrivate: tasklist?.isPrivate ?? tasklist?.private,
    isArchived: tasklist?.isArchived ?? tasklist?.archived,
    displayOrder: tasklist?.displayOrder,
    taskCount: tasklist?.taskCount ?? tasklist?.tasksCount,
    completeTaskCount: tasklist?.completeTaskCount ?? tasklist?.completedTaskCount
  });
}

export function compactTasklistsPayload(payload: any, options: { includeRaw?: boolean } = {}): any {
  const tasklists = Array.isArray(payload?.tasklists)
    ? payload.tasklists
    : Array.isArray(payload)
    ? payload
    : payload?.tasklist
    ? [payload.tasklist]
    : [];

  return removeEmpty({
    count: tasklists.length,
    tasklists: tasklists.map(compactTasklist),
    pagination: paginationFrom(payload),
    raw: options.includeRaw ? payload : undefined
  });
}

function removeEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeEmpty(item))
      .filter((item) => item !== null && item !== undefined && item !== "") as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: RecordMap = {};
  for (const [key, rawValue] of Object.entries(value as RecordMap)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }
    const cleaned = removeEmpty(rawValue);
    if (Array.isArray(cleaned) && cleaned.length === 0) {
      continue;
    }
    if (cleaned && typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) {
      continue;
    }
    result[key] = cleaned;
  }
  return result as T;
}
