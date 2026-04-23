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
    "Get tasks where the most recent comment is NOT from excludedUserId (default 364769). Alias params are accepted (excludeUserId/excludeuserid, projectId/projectids, pagesize/maxpages/maxtasks, commentedAfterHours/commentedAfter).",
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
      excludeUserId: {
        type: "integer",
        description: "Alias for excludedUserId."
      },
      excludeuserid: {
        type: "integer",
        description: "Lowercase alias for excludedUserId."
      },
      commentedAfterHours: {
        type: "integer",
        description: "Alias for sinceHours."
      },
      commentedAfter: {
        type: "string",
        description: "Alias for sinceHours as string (examples: '48', '48h', '48hrs')."
      },
      projectIds: {
        type: "array",
        items: {
          type: "integer"
        },
        description: "Optional project IDs to scope comment scan."
      },
      projectId: {
        type: "integer",
        description: "Alias for a single project ID filter."
      },
      projectids: {
        type: "array",
        items: {
          type: "integer"
        },
        description: "Lowercase alias for projectIds."
      },
      pageSize: {
        type: "integer",
        description: "Comment page size for backend scan. Default: 100."
      },
      pagesize: {
        type: "integer",
        description: "Lowercase alias for pageSize."
      },
      maxPages: {
        type: "integer",
        description: "Maximum comment pages to scan. Default: 10."
      },
      maxpages: {
        type: "integer",
        description: "Lowercase alias for maxPages."
      },
      maxTasks: {
        type: "integer",
        description: "Maximum tasks to return. Default: 200."
      },
      maxtasks: {
        type: "integer",
        description: "Lowercase alias for maxTasks."
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
