/**
 * getWorkflows tool
 * Retrieves workflows using Teamwork workflow endpoint
 */

import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const getWorkflowsDefinition = {
  name: "getWorkflows",
  description:
    "Get all workflows using GET /projects/api/v3/workflows.json with Teamwork-documented query params. Use returned workflow IDs with updateTask.workflowId for deterministic task stage updates.",
  inputSchema: {
    type: "object",
    properties: {
      updatedAfter: {
        type: "string",
        description: "Filter by updated after date."
      },
      status: {
        type: "string",
        description: "Filter by workflow status."
      },
      searchTerm: {
        type: "string",
        description: "Filter by search term."
      },
      cursor: {
        type: "string",
        description: "Cursor used for pagination."
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
        description: "Include deleted items."
      },
      onlyDefaultWorkflow: {
        type: "boolean",
        description: "Filter by the default workflow."
      },
      matchAllStageNames: {
        type: "boolean",
        description: "Enforce all stage names must be matched."
      },
      includeTotalCount: {
        type: "boolean",
        description: "Include installation-wide total counts."
      },
      includeArchived: {
        type: "boolean",
        description: "Include archived workflows."
      },
      workflowIds: {
        type: "array",
        items: { type: "integer" },
        description: "Filter by workflow IDs."
      },
      stageNames: {
        type: "array",
        items: { type: "string" },
        description: "Filter workflows by exact stage names."
      },
      projectIds: {
        type: "array",
        items: { type: "integer" },
        description: "Filter by project IDs."
      },
      include: {
        type: "array",
        items: {
          type: "string",
          enum: ["projects", "stages", "users", "teams", "companies"]
        },
        description: "Include related resources."
      },
      fieldsWorkflows: {
        type: "array",
        items: {
          type: "string",
          enum: ["id", "name", "statusId"]
        },
        description: "Select fields[workflows]."
      },
      fieldsUsers: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "id",
            "firstName",
            "lastName",
            "title",
            "email",
            "companyId",
            "company",
            "isAdmin",
            "isClientUser",
            "isServiceAccount",
            "type",
            "deleted",
            "avatarUrl",
            "lengthOfDay",
            "workingHoursId",
            "workingHour",
            "userRate",
            "userCost",
            "canAddProjects"
          ]
        },
        description: "Select fields[users]."
      },
      fieldsTeams: {
        type: "array",
        items: {
          type: "string",
          enum: ["id", "name", "teamLogo", "teamLogoIcon", "teamLogoColor"]
        },
        description: "Select fields[teams]."
      },
      fieldsStages: {
        type: "array",
        items: {
          type: "string",
          enum: ["id", "name", "stage"]
        },
        description: "Select fields[stages]."
      },
      fieldsProjects: {
        type: "array",
        items: {
          type: "string",
          enum: ["id", "name"]
        },
        description: "Select fields[projects]."
      },
      fieldsCompanies: {
        type: "array",
        items: {
          type: "string",
          enum: ["id", "name", "logoUploadedToServer", "logoImage"]
        },
        description: "Select fields[companies]."
      },
      projectId: {
        type: "integer",
        description: "Convenience alias for a single project ID. Converted to projectIds."
      },
      includeArchivedWorkflows: {
        type: "boolean",
        description: "Backward-compatible alias for includeArchived."
      }
    }
  },
  annotations: {
    title: "Get Workflows",
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false
  }
};

export async function handleGetWorkflows(input: any) {
  try {
    const params: Record<string, any> = { ...(input ?? {}) };

    if (params.projectId !== undefined && params.projectIds === undefined) {
      params.projectIds = [params.projectId];
    }
    if (params.includeArchivedWorkflows !== undefined && params.includeArchived === undefined) {
      params.includeArchived = params.includeArchivedWorkflows;
    }

    if (params.fieldsWorkflows !== undefined) params["fields[workflows]"] = params.fieldsWorkflows;
    if (params.fieldsUsers !== undefined) params["fields[users]"] = params.fieldsUsers;
    if (params.fieldsTeams !== undefined) params["fields[teams]"] = params.fieldsTeams;
    if (params.fieldsStages !== undefined) params["fields[stages]"] = params.fieldsStages;
    if (params.fieldsProjects !== undefined) params["fields[projects]"] = params.fieldsProjects;
    if (params.fieldsCompanies !== undefined) params["fields[companies]"] = params.fieldsCompanies;

    delete params.projectId;
    delete params.includeArchivedWorkflows;
    delete params.fieldsWorkflows;
    delete params.fieldsUsers;
    delete params.fieldsTeams;
    delete params.fieldsStages;
    delete params.fieldsProjects;
    delete params.fieldsCompanies;

    const response = await teamworkService.getWorkflows(params);
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
            "Getting workflows failed: Teamwork API client (v3) is not initialized. " +
            "Set TEAMWORK_DOMAIN, TEAMWORK_USERNAME, and TEAMWORK_PASSWORD in .env (repo root) or build/.env, then restart MCP Inspector."
        }]
      };
    }
    return createErrorResponse(error, "Getting workflows");
  }
}
