/**
 * updateWorkflowStage tool
 * Updates a workflow stage using Teamwork workflow stage endpoint
 */

import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const updateWorkflowStageDefinition = {
  name: "updateWorkflowStage",
  description:
    "Update a workflow stage via PATCH /projects/api/v3/workflows/{workflowId}/stages/{stageId}.json. This edits stage metadata (name/label), not task assignment.",
  inputSchema: {
    type: "object",
    properties: {
      workflowId: {
        type: "integer",
        description: "Workflow ID containing the stage."
      },
      stageId: {
        type: "integer",
        description: "Stage ID to update."
      },
      stageName: {
        type: "string",
        description: "Optional shorthand for stage label/name update. Mapped to payload stage.name and stage.stage."
      },
      payload: {
        type: "object",
        description:
          "Optional raw PATCH body. If provided, sent as-is. Use this for advanced stage updates supported by Teamwork."
      }
    },
    required: ["workflowId", "stageId"]
  },
  annotations: {
    title: "Update Workflow Stage",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

export async function handleUpdateWorkflowStage(input: any) {
  try {
    const workflowId = input?.workflowId;
    const stageId = input?.stageId;

    if (workflowId === undefined || stageId === undefined) {
      throw new Error("workflowId and stageId are required.");
    }

    let payload = input?.payload;
    if (!payload || typeof payload !== "object") {
      payload = {};
    }

    const stageName = typeof input?.stageName === "string" ? input.stageName.trim() : "";
    if (stageName) {
      payload.stage = payload.stage ?? {};
      if (typeof payload.stage !== "object") {
        payload.stage = {};
      }
      if (!payload.stage.name) {
        payload.stage.name = stageName;
      }
      if (!payload.stage.stage) {
        payload.stage.stage = stageName;
      }
    }

    if (!payload || Object.keys(payload).length === 0) {
      throw new Error("Nothing to update. Provide stageName and/or payload.");
    }

    const response = await teamworkService.updateWorkflowStage(
      String(workflowId),
      String(stageId),
      payload
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
            "Updating workflow stage failed: Teamwork API client (v3) is not initialized. " +
            "Set TEAMWORK_DOMAIN, TEAMWORK_USERNAME, and TEAMWORK_PASSWORD in .env (repo root) or build/.env, then restart MCP Inspector."
        }]
      };
    }
    return createErrorResponse(error, "Updating workflow stage");
  }
}
