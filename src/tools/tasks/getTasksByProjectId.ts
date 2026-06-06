/**
 * getTasksByProjectId tool
 * Retrieves tasks from a specific project in Teamwork
 */

import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";
import { enrichTaskLookupValues } from "./taskLookup.js";
import { compactTaskPayload, stringifyToolResponse, wantsRawOutput } from "./compactTaskResponse.js";

// Tool definition
export const getTasksByProjectIdDefinition = {
  name: "getTasksByProjectId",
  description: "Get all tasks from a specific project in Teamwork",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        description: "The ID of the project to get tasks from"
      },
      includeRaw: {
        type: "boolean",
        description: "Return the original Teamwork API payload under raw in addition to compact task rows."
      },
      include_raw: {
        type: "boolean",
        description: "Alias for includeRaw."
      },
      descriptionMaxLength: {
        type: "integer",
        description: "Maximum length for task descriptionPreview in list results. Default: 280."
      }
    },
    required: ["projectId"]
  },
  annotations: {
    title: "Get Tasks by Project ID",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

// Tool handler
export async function handleGetTasksByProjectId(input: any) {
  logger.info('Calling teamworkService.getTasksByProjectId()');
  logger.info(`Project ID: ${input?.projectId}`);
  
  try {
    const projectId = String(input?.projectId);
    if (!projectId) {
      throw new Error("Project ID is required");
    }
    
    const tasks = await teamworkService.getTasksByProjectId(projectId);
    const enrichedTasks = await enrichTaskLookupValues(tasks);
    const compactTasks = compactTaskPayload(enrichedTasks, {
      mode: "list",
      includeRaw: wantsRawOutput(input),
      descriptionMaxLength: typeof input?.descriptionMaxLength === "number" ? input.descriptionMaxLength : undefined
    });
    logger.info(`Tasks response received for project ID: ${projectId}`);
    
    return {
      content: [{
        type: "text",
        text: stringifyToolResponse(compactTasks)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Retrieving tasks for project');
  }
} 
