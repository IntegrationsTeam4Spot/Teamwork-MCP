/**
 * uncompleteTask tool
 * Marks a task as incomplete using Teamwork's dedicated endpoint.
 */

import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const uncompleteTaskDefinition = {
  name: "uncompleteTask",
  description: "Mark a completed task as incomplete. Optionally reset task progress to 0 in the same call.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "The ID of the task to uncomplete"
      },
      resetProgressToZero: {
        type: "boolean",
        description: "When true, also sets task progress to 0 after uncompleting",
        default: true
      }
    },
    required: ["taskId"]
  },
  annotations: {
    title: "Uncomplete a Task",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

export async function handleUncompleteTask(input: any) {
  logger.info("Calling teamworkService.uncompleteTask()");
  logger.info(`Task ID: ${input?.taskId}`);

  try {
    const taskId = String(input?.taskId);
    if (!taskId) {
      throw new Error("Task ID is required");
    }

    const resetProgressToZero =
      input?.resetProgressToZero === undefined ? true : Boolean(input.resetProgressToZero);

    const result = await teamworkService.uncompleteTask(taskId, resetProgressToZero);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Uncompleting task');
  }
}
