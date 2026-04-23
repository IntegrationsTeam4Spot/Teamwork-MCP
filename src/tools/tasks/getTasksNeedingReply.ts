/**
 * getTasksNeedingReply tool
 * Retrieves tasks whose latest comment is not by a specified user.
 */

import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const getTasksNeedingReplyDefinition = {
  name: "getTasksNeedingReply",
  description:
    "Get tasks where the most recent comment is NOT from excludedUserId (default 364769). This is optimized for daily check-ins where team members asked questions and Jeff has not replied yet.",
  inputSchema: {
    type: "object",
    properties: {
      sinceHours: {
        type: "integer",
        description: "How far back to scan comments. Default: 48."
      },
      excludedUserId: {
        type: "integer",
        description: "User ID to exclude as latest commenter. Default: 364769 (Jeff)."
      },
      projectIds: {
        type: "array",
        items: {
          type: "integer"
        },
        description: "Optional project IDs to scope comment scan."
      },
      pageSize: {
        type: "integer",
        description: "Comment page size for backend scan. Default: 100."
      },
      maxPages: {
        type: "integer",
        description: "Maximum comment pages to scan. Default: 10."
      },
      maxTasks: {
        type: "integer",
        description: "Maximum tasks to return. Default: 200."
      }
    }
  },
  annotations: {
    title: "Get Tasks Needing Reply",
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false
  }
};

export async function handleGetTasksNeedingReply(input: any) {
  logger.info("Calling teamworkService.getTasksNeedingReply()");
  try {
    const response = await teamworkService.getTasksNeedingReply(input ?? {});
    return {
      content: [{
        type: "text",
        text: JSON.stringify(response, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, "Getting tasks needing reply");
  }
}

