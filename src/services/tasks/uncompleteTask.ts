import logger from '../../utils/logger.js';
import { ensureApiClient } from '../core/apiClient.js';
import { TaskRequest } from '../../models/TaskRequest.js';

export interface UncompleteTaskResult {
  taskId: string;
  uncompleted: boolean;
  progressReset: boolean;
}

/**
 * Marks a completed task as incomplete.
 * Teamwork uses a dedicated endpoint for this action.
 */
export const uncompleteTask = async (
  taskId: string,
  resetProgressToZero: boolean = false
): Promise<UncompleteTaskResult> => {
  try {
    const api = ensureApiClient();
    let uncompleted = false;
    let progressReset = false;

    try {
      await api.delete(`/tasks/${taskId}/complete`);
      uncompleted = true;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        await api.delete(`/tasks/${taskId}/complete.json`);
        uncompleted = true;
      } else {
        throw error;
      }
    }

    if (resetProgressToZero) {
      const payload: TaskRequest = {
        task: {
          progress: 0
        }
      };
      await api.patch(`/tasks/${taskId}.json`, payload);
      progressReset = true;
    }

    return {
      taskId,
      uncompleted,
      progressReset
    };
  } catch (error: any) {
    logger.error(`Error uncompleting task ${taskId}: ${error.message}`);
    throw new Error(`Failed to uncomplete task ${taskId}: ${error.message}`);
  }
};

export default uncompleteTask;
