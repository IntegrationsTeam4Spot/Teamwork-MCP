/**
 * Get all subtasks for a specific task.
 * Return multiple subtasks according to the provided filter.
 *
 * On this endpoint you can filter by custom fields. The syntax for the
 * query parameter is the following:
 *
 *     customField[id][op]=value
 *
 * Where:
 *   - [id] is the custom field ID
 *   - [op] is the operator to apply when filtering, different operators are
 *     allowed according to the custom field type
 *   - [value] is the value to apply when filtering
 *
 * For example, if I want to filter a dropdown custom field with ID 10 to only
 * return entries that have the value "Option1" we would do the following:
 *
 *     customField[10][eq]=Option1
 *
 * The allowed operators are:
 *   - like
 *   - not-like
 *   - eq
 *   - not
 *   - lt
 *   - gt
 *   - any
 */

import logger from "../../utils/logger.js";
import { getApiClientForVersion } from "../../services/core/apiClient.js";
import { createErrorResponse } from "../../utils/errorHandler.js";
import { enrichTaskLookupValues } from "./taskLookup.js";

// Tool definition
export const getTaskSubtasksDefinition = {
  name: "getTaskSubtasks",
  description: "Get all subtasks for a specific task in Teamwork",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "integer",
        description: "The ID of the task to get subtasks from"
      },
      page: {
        type: "integer",
        description: "Page number for pagination"
      },
      pageSize: {
        type: "integer",
        description: "Number of items per page"
      },
      includeCompletedTasks: {
        type: "boolean",
        description: "Include completed tasks in the results"
      }
    },
    required: ["taskId"]
  },
  annotations: {
    title: "Get Task Subtasks",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

// Tool handler
export async function handleGetTaskSubtasks(input: any) {
  try {
    const { taskId, page, pageSize, includeCompletedTasks, ...otherParams } = input;
    
    logger.info(`Getting subtasks for task ID: ${taskId}`);
    
    // Build query parameters
    const queryParams: Record<string, any> = {
      page,
      pageSize,
      includeCompletedTasks,
      ...otherParams
    };
    
    // Filter out undefined values
    Object.keys(queryParams).forEach(key => 
      queryParams[key] === undefined && delete queryParams[key]
    );

    const includeValues = new Set<string>(Array.isArray(queryParams.include) ? queryParams.include : []);
    includeValues.add("projects");
    includeValues.add("tasklists");
    includeValues.add("tags");
    queryParams.include = Array.from(includeValues);
    if (queryParams["fields[tasklists]"] === undefined) {
      queryParams["fields[tasklists]"] = ["id", "name", "projectId"];
    }
    if (queryParams["fields[projects]"] === undefined) {
      queryParams["fields[projects]"] = ["id", "name"];
    }
    if (queryParams["fields[tags]"] === undefined) {
      queryParams["fields[tags]"] = ["id", "name"];
    }
    
    // Make API call
    const apiClient = getApiClientForVersion();
    const response = await apiClient.get(
      `/tasks/${taskId}/subtasks.json`, 
      { params: queryParams }
    );
    const enrichedResponse = await enrichTaskLookupValues(response.data);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(enrichedResponse, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Retrieving task subtasks');
  }
} 
