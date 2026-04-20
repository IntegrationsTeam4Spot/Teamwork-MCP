/**
 * getWorkflowStages tool
 * Retrieves stages for a workflow using Teamwork workflow stages endpoint
 */

import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const getWorkflowStagesDefinition = {
  name: "getWorkflowStages",
  description:
    "Get all stages for a workflow using GET /projects/api/v3/workflows/{workflowId}/stages.json with Teamwork-documented query params. Use returned stage IDs with updateTask.workflowStageId (or taskRequest.workflows.stageId) for reliable task stage moves.",
  inputSchema: {
    type: "object",
    properties: {
      workflowId: {
        type: "integer",
        description: "Workflow ID path parameter. Resolve from getWorkflows or task workflow metadata."
      },
      updatedAfter: {
        type: "string",
        description: "Filter by updated after date."
      },
      orderMode: {
        type: "string",
        enum: ["asc", "desc"],
        description: "Order mode."
      },
      orderBy: {
        type: "string",
        enum: ["id", "name", "displayorder"],
        description: "Order by field."
      },
      cursor: {
        type: "string",
        description: "Cursor for pagination."
      },
      pageSize: {
        type: "integer",
        description: "Number of items in a page."
      },
      page: {
        type: "integer",
        description: "Page number."
      },
      limit: {
        type: "integer",
        description: "Number of items to show when providing cursor."
      },
      showDeleted: {
        type: "boolean",
        description: "Include deleted stages."
      },
      include: {
        type: "array",
        items: {
          type: "string",
          enum: ["workflows"]
        },
        description: "Include related resources."
      },
      ids: {
        type: "array",
        items: { type: "integer" },
        description: "Filter by stage IDs."
      },
      fieldsWorkflows: {
        type: "array",
        items: {
          type: "string",
          enum: ["id", "name", "statusId"]
        },
        description: "Select fields[workflows]."
      },
      fieldsStages: {
        type: "array",
        items: {
          type: "string",
          enum: ["id", "name", "stage"]
        },
        description: "Select fields[stages]."
      }
    },
    required: ["workflowId"]
  },
  annotations: {
    title: "Get Workflow Stages",
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false
  }
};

export const getWorkflowStagesByWorkflowIdDefinition = {
  ...getWorkflowStagesDefinition,
  name: "getWorkflowStagesByWorkflowId",
  annotations: {
    ...getWorkflowStagesDefinition.annotations,
    title: "Get Workflow Stages By Workflow ID"
  }
};

export async function handleGetWorkflowStages(input: any) {
  try {
    if (input?.workflowId === undefined || input?.workflowId === null) {
      throw new Error("workflowId is required.");
    }

    const workflowId = String(input.workflowId);
    const params: Record<string, any> = { ...(input ?? {}) };
    delete params.workflowId;

    if (params.fieldsWorkflows !== undefined) params["fields[workflows]"] = params.fieldsWorkflows;
    if (params.fieldsStages !== undefined) params["fields[stages]"] = params.fieldsStages;
    delete params.fieldsWorkflows;
    delete params.fieldsStages;

    const response = await teamworkService.getWorkflowStagesByWorkflowId(workflowId, params);
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
            "Getting workflow stages failed: Teamwork API client (v3) is not initialized. " +
            "Set TEAMWORK_DOMAIN, TEAMWORK_USERNAME, and TEAMWORK_PASSWORD in .env (repo root) or build/.env, then restart MCP Inspector."
        }]
      };
    }
    return createErrorResponse(error, "Getting workflow stages");
  }
}

export const handleGetWorkflowStagesByWorkflowId = handleGetWorkflowStages;
