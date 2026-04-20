/**
 * updateWorkflowStage tool
 * Updates a workflow stage using Teamwork workflow stage endpoint
 */

import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

const STAGE_WRAPPER_KEYS = [
  "id",
  "name",
  "statusId",
  "displayOrder",
  "projectStatuses"
];

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStagePatchPayload(input: any): Record<string, any> {
  const payload = input?.payload && typeof input.payload === "object" ? { ...input.payload } : {};

  const inputName = toNonEmptyString(input?.name) ?? toNonEmptyString(input?.stageName) ?? toNonEmptyString(input?.stage);

  const hasWrapperShape = STAGE_WRAPPER_KEYS.some((key) => payload[key] !== undefined);
  if (hasWrapperShape) {
    const existingStage =
      payload.stage && typeof payload.stage === "object" && !Array.isArray(payload.stage)
        ? { ...payload.stage }
        : {};

    for (const key of STAGE_WRAPPER_KEYS) {
      if (payload[key] !== undefined && existingStage[key] === undefined) {
        existingStage[key] = payload[key];
      }
      delete payload[key];
    }

    payload.stage = existingStage;
  }

  if (typeof payload.stage === "string") {
    payload.stage = {
      name: payload.stage
    };
  }

  if (!payload.stage || typeof payload.stage !== "object" || Array.isArray(payload.stage)) {
    payload.stage = {};
  }

  if (inputName && payload.stage.name === undefined) {
    payload.stage.name = inputName;
  }

  if (payload.stage && typeof payload.stage === "object" && payload.stage.stage !== undefined) {
    if (payload.stage.name === undefined && toNonEmptyString(payload.stage.stage)) {
      payload.stage.name = toNonEmptyString(payload.stage.stage);
    }
    delete payload.stage.stage;
  }

  if (Object.keys(payload.stage).length === 0) {
    delete payload.stage;
  }

  return payload;
}

export const updateWorkflowStageDefinition = {
  name: "updateWorkflowStage",
  description:
    "Update workflow stage metadata (for example stage name/label) via PATCH /projects/api/v3/workflows/{workflowId}/stages/{stageId}.json. This does NOT move tasks between stages. Use updateTask for task stage moves. Supported rename inputs: top-level name/stageName/stage, payload.name, or payload.stage.name.",
  inputSchema: {
    type: "object",
    properties: {
      workflowId: {
        type: "integer",
        description: "Workflow ID containing the stage to edit."
      },
      stageId: {
        type: "integer",
        description: "Stage ID to edit."
      },
      stageName: {
        type: "string",
        description: "Optional shorthand for stage label/name update. Equivalent to setting name."
      },
      name: {
        type: "string",
        description: "Optional shorthand alias for stageName. Example: { name: 'Backlog' }."
      },
      stage: {
        type: "string",
        description: "Optional shorthand alias for stageName/name."
      },
      payload: {
        type: "object",
        description:
          "Optional PATCH body. Flat shape like { name: 'Backlog' } is supported. Wrapped shape { stage: { name: 'Backlog' } } is also accepted and auto-normalized for tenant compatibility."
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

    const payload = normalizeStagePatchPayload(input);

    if (!payload || Object.keys(payload).length === 0) {
      throw new Error("Nothing to update. Provide stageName/name/stage and/or payload.");
    }

    let response: any;
    try {
      response = await teamworkService.updateWorkflowStage(
        String(workflowId),
        String(stageId),
        payload
      );
    } catch (error: any) {
      const message = String(error?.message ?? "");
      const canRetryFlat =
        message.includes('unknown field "stage"') &&
        payload?.stage &&
        typeof payload.stage === "object" &&
        !Array.isArray(payload.stage);

      if (!canRetryFlat) {
        throw error;
      }

      const fallbackPayload = {
        ...payload,
        ...payload.stage
      };
      delete (fallbackPayload as any).stage;

      response = await teamworkService.updateWorkflowStage(
        String(workflowId),
        String(stageId),
        fallbackPayload
      );
    }

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
