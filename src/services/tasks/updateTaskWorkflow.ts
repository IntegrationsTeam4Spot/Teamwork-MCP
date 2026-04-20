/**
 * updateTaskWorkflow service
 * Moves/repositions an existing task inside a workflow lane
 *
 * PATCH /tasks/{taskId}/workflows/{workflowId}.json
 */

import logger from "../../utils/logger.js";
import { ensureApiClient } from "../core/apiClient.js";

export interface TaskWorkflowUpdateRequest {
  workflowId: number;
  stageId?: number;
  positionAfterTask?: number;
}

export interface TaskWorkflowUpdateResult {
  moved: boolean;
  method: "patchTaskWorkflow" | "postStageTasks" | "postStageTasksAfterPatchMismatch";
  status: number;
  response: any;
}

const isSuccessStatus = (status: number): boolean => status >= 200 && status < 300;
const normalizeResponseBody = (value: any): any => (value === "" ? null : value);

const summarizeError = (error: any): string => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  let detail = "";
  if (data !== undefined) {
    try {
      detail = ` Response: ${JSON.stringify(data).slice(0, 1200)}`;
    } catch {
      detail = " Response: [unserializable]";
    }
  }
  if (status) {
    return `HTTP ${status}.${detail}`;
  }
  return `${error?.message ?? "Unknown error"}.${detail}`;
};

const getStageIdForWorkflowFromTaskResponse = (
  taskResponse: any,
  workflowId: number
): number | undefined => {
  const task = taskResponse?.task ?? taskResponse;
  const workflowStages = Array.isArray(task?.workflowStages) ? task.workflowStages : [];
  const match = workflowStages.find((entry: any) => Number(entry?.workflowId) === workflowId);
  if (!match) {
    return undefined;
  }
  const stageId = Number(match?.stageId);
  return Number.isFinite(stageId) ? stageId : undefined;
};

const moveTaskViaStageEndpoint = async (
  apiClient: any,
  taskId: string,
  workflowId: number,
  stageId: number
): Promise<TaskWorkflowUpdateResult> => {
  const stageMoveUrl = `/workflows/${workflowId}/stages/${stageId}/tasks.json`;
  const stageMovePayload: Record<string, any> = {
    taskIds: [Number(taskId)]
  };

  const fallbackResponse = await apiClient.post(stageMoveUrl, stageMovePayload);
  if (!isSuccessStatus(fallbackResponse.status)) {
    throw new Error(
      `Fallback stage move failed: HTTP ${fallbackResponse.status}. ` +
      `${JSON.stringify(fallbackResponse.data ?? {}).slice(0, 1200)}`
    );
  }
  return {
    moved: true,
    method: "postStageTasks",
    status: fallbackResponse.status,
    response: normalizeResponseBody(fallbackResponse.data ?? null)
  };
};

export async function updateTaskWorkflow(
  taskId: string,
  workflowUpdate: TaskWorkflowUpdateRequest
): Promise<TaskWorkflowUpdateResult> {
  const apiClient = await ensureApiClient();
  const workflowMoveUrl = `/tasks/${taskId}/workflows/${workflowUpdate.workflowId}.json`;

  const patchPayload: Record<string, any> = {
    taskId: Number(taskId),
    workflowId: workflowUpdate.workflowId
  };

  if (workflowUpdate.stageId !== undefined) {
    patchPayload.stageId = workflowUpdate.stageId;
  }
  if (workflowUpdate.positionAfterTask !== undefined) {
    patchPayload.positionAfterTask = workflowUpdate.positionAfterTask;
  }

  try {
    const response = await apiClient.patch(workflowMoveUrl, patchPayload);
    if (!isSuccessStatus(response.status)) {
      throw new Error(
        `Task workflow update failed: HTTP ${response.status}. ` +
        `${JSON.stringify(response.data ?? {}).slice(0, 1200)}`
      );
    }

    if (workflowUpdate.stageId !== undefined) {
      try {
        const verifyResponse = await apiClient.get(`/tasks/${taskId}.json`);
        const currentStageId = getStageIdForWorkflowFromTaskResponse(
          verifyResponse.data,
          workflowUpdate.workflowId
        );
        if (currentStageId !== workflowUpdate.stageId) {
          const fallback = await moveTaskViaStageEndpoint(
            apiClient,
            taskId,
            workflowUpdate.workflowId,
            workflowUpdate.stageId
          );
          return {
            ...fallback,
            method: "postStageTasksAfterPatchMismatch"
          };
        }
      } catch (verifyOrFallbackError: any) {
        const summary = summarizeError(verifyOrFallbackError);
        logger.warn(
          `Patch workflow update succeeded but verification/fallback failed for task ${taskId}: ${summary}`
        );
      }
    }

    return {
      moved: true,
      method: "patchTaskWorkflow",
      status: response.status,
      response: normalizeResponseBody(response.data ?? null)
    };
  } catch (error: any) {
    // Fallback for tenants where task-workflow PATCH is restrictive:
    // move task to stage via stage-tasks endpoint when stageId is provided.
    if (workflowUpdate.stageId !== undefined) {
      try {
        return await moveTaskViaStageEndpoint(
          apiClient,
          taskId,
          workflowUpdate.workflowId,
          workflowUpdate.stageId
        );
      } catch (fallbackError: any) {
        const primary = summarizeError(error);
        const fallback = summarizeError(fallbackError);
        logger.error(
          `Error updating workflow placement for task ${taskId}. ` +
          `Primary PATCH failed (${primary}); fallback stage move failed (${fallback}).`
        );
        throw new Error(
          `Task workflow update failed. Primary PATCH failed (${primary}); ` +
          `fallback stage move failed (${fallback}).`
        );
      }
    }

    const summary = summarizeError(error);
    logger.error(`Error updating workflow placement for task ${taskId}: ${summary}`);
    throw new Error(`Task workflow update failed: ${summary}`);
  }
}

export default updateTaskWorkflow;
