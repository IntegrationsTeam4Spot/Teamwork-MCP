/**
 * getTaskById tool
 * Retrieves a specific task by ID from Teamwork
 */

import logger from "../../utils/logger.js"; 
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";
import { enrichTaskLookupValues } from "./taskLookup.js";

// Tool definition
export const getTaskByIdDefinition = {
  name: "getTaskById",
  description: "Get a specific task by ID from Teamwork, with enriched lookup details such as project name, task list name, tag names, workflow/stage names, and normalized workflow IDs (positionAfterTask, stageId, workflowId) when resolvable.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "The ID of the task to retrieve"
      }
    },
    required: ["taskId"]
  },
  annotations: {
    title: "Get a Task by its ID",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

// Tool handler
export async function handleGetTaskById(input: any) {
  logger.info('Calling teamworkService.getTaskById()');
  logger.info(`Task ID: ${input?.taskId}`);
  
  try {
    const taskId = String(input?.taskId);
    if (!taskId) {
      throw new Error("Task ID is required");
    }
    
    const task = await teamworkService.getTaskById(taskId);
    const enrichedTask = await enrichTaskLookupValues(task);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(enrichedTask, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Retrieving task');
  }
} 
