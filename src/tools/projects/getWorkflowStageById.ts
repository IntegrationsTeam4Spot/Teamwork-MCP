/**
 * getWorkflowStageById tool
 * Retrieves one stage for a workflow by stage ID
 */

import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const getWorkflowStageByIdDefinition = {
  name: "getWorkflowStageById",
  description:
    "Get a specific workflow stage using GET /projects/api/v3/workflows/{workflowId}/stages/{stageId}.json. Useful to validate IDs before updateTask.",
  inputSchema: {
    type: "object",
    properties: {
      workflowId: {
        type: "integer",
        description: "Workflow ID path parameter."
      },
      stageId: {
        type: "integer",
        description: "Stage ID path parameter."
      }
    },
    required: ["workflowId", "stageId"]
  },
  annotations: {
    title: "Get Workflow Stage By ID",
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false
  }
};

export async function handleGetWorkflowStageById(input: any) {
  try {
    if (input?.workflowId === undefined || input?.stageId === undefined) {
      throw new Error("workflowId and stageId are required.");
    }

    const response = await teamworkService.getWorkflowStageById(
      String(input.workflowId),
      String(input.stageId)
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  } catch (error: any) {
    if (String(error?.message ?? "").includes("Teamwork API client (v3) is not initialized")) {
      return {
        content: [{
          type: "text",
          text:
            "Getting workflow stage failed: Teamwork API client (v3) is not initialized. " +
            "Set TEAMWORK_DOMAIN, TEAMWORK_USERNAME, and TEAMWORK_PASSWORD in .env (repo root) or build/.env, then restart MCP Inspector."
        }]
      };
    }
    return createErrorResponse(error, "Getting workflow stage");
  }
}
