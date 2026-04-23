/**
 * getProjects tool
 * Retrieves projects from Teamwork
 */

import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

// Tool definition
export const getProjectsDefinition = {
  name: "getProjects",
  description: "Get projects from Teamwork via GET /projects.json. Optional status filter supported. Returns simplified project rows with id, name, and status.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["active", "current", "late", "upcoming", "completed", "deleted"],
        description: "Optional convenience filter mapped to Teamwork projectStatuses."
      },
      includeRaw: {
        type: "boolean",
        description: "Optional: include the raw API response alongside simplified output."
      },
      // String parameters
      updatedAfter: {
        type: "string",
        description: "Filter projects updated after this date-time (format: ISO 8601)"
      },
      timeMode: {
        type: "string",
        enum: ["timelogs", "estimated"],
        description: "Profitability time mode"
      },
      searchTerm: {
        type: "string",
        description: "Filter by project name"
      },
      reportType: {
        type: "string",
        enum: ["project", "health"],
        description: "Define the type of the report"
      },
      reportTimezone: {
        type: "string",
        description: "Configure the report dates displayed in a timezone"
      },
      reportFormat: {
        type: "string",
        enum: ["csv", "html", "pdf", "xls"],
        description: "Define the format of the report"
      },
      projectType: {
        type: "string",
        description: "Filter by project type"
      },
      orderMode: {
        type: "string",
        enum: ["asc", "desc"],
        description: "Order mode"
      },
      orderBy: {
        type: "string",
        enum: ["companyname", "datecreated", "duedate", "lastactivity", "name", "namecaseinsensitive", "ownercompany", "starred", "categoryname"],
        description: "Order by field"
      },
      notCompletedBefore: {
        type: "string",
        description: "Filter by projects that have not been completed before the given date (format: YYYY-MM-DD)"
      },
      minLastActivityDate: {
        type: "string",
        description: "Filter by min last activity date (format: YYYY-MM-DD)"
      },
      maxLastActivityDate: {
        type: "string",
        description: "Filter by max last activity date (format: YYYY-MM-DD)"
      },
      
      // Integer parameters
      userId: {
        type: "integer",
        description: "Filter by user id"
      },
      pageSize: {
        type: "integer",
        description: "Number of items in a page (not used when generating reports)"
      },
      page: {
        type: "integer",
        description: "Page number (not used when generating reports)"
      },
      orderByCustomFieldId: {
        type: "integer",
        description: "Order by custom field id when orderBy is equal to customfield"
      },
      minBudgetCapacityUsedPercent: {
        type: "integer",
        description: "Filter by minimum budget capacity used"
      },
      maxBudgetCapacityUsedPercent: {
        type: "integer",
        description: "Filter by maximum budget capacity used"
      },
      
      // Boolean parameters
      includeArchivedProjects: {
        type: "boolean",
        description: "Include archived projects"
      },
      includeCompletedProjects: {
        type: "boolean",
        description: "Include completed projects"
      },
      includeProjectOwner: {
        type: "boolean",
        description: "Include project owner"
      },
      includeProjectCreator: {
        type: "boolean",
        description: "Include project creator"
      },
      includeProjectCompany: {
        type: "boolean",
        description: "Include project company"
      },
      includeProjectCategory: {
        type: "boolean",
        description: "Include project category"
      },
      includeProjectTags: {
        type: "boolean",
        description: "Include project tags"
      },
      includeProjectStatus: {
        type: "boolean",
        description: "Include project status details when available."
      },
      includeProjectHealth: {
        type: "boolean",
        description: "Include project health"
      },
      includeProjectBudget: {
        type: "boolean",
        description: "Include project budget"
      },
      includeProjectProfitability: {
        type: "boolean",
        description: "Include project profitability"
      },
      includeProjectCustomFields: {
        type: "boolean",
        description: "Include project custom fields"
      },
      includeProjectBillingMethod: {
        type: "boolean",
        description: "Include project billing method"
      },
      includeProjectRateCards: {
        type: "boolean",
        description: "Include project rate cards"
      },
      includeProjectRateCardRates: {
        type: "boolean",
        description: "Include project rate card rates"
      },
      includeProjectRateCardCurrencies: {
        type: "boolean",
        description: "Include project rate card currencies"
      },
      includeProjectRateCardUsers: {
        type: "boolean",
        description: "Include project rate card users"
      },
      includeProjectRateCardUserRates: {
        type: "boolean",
        description: "Include project rate card user rates"
      },
      includeProjectRateCardUserCurrencies: {
        type: "boolean",
        description: "Include project rate card user currencies"
      },
      includeProjectRateCardTasks: {
        type: "boolean",
        description: "Include project rate card tasks"
      },
      includeProjectRateCardTaskRates: {
        type: "boolean",
        description: "Include project rate card task rates"
      },
      includeProjectRateCardTaskCurrencies: {
        type: "boolean",
        description: "Include project rate card task currencies"
      }
    }
  },
  annotations: {
    title: "Get Projects",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

function normalizeStatus(value: any): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function extractProjectsArray(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.projects)) {
    return payload.projects;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

function statusFromProject(project: any): string {
  const directStatus =
    normalizeStatus(project?.status) ??
    normalizeStatus(project?.status?.name) ??
    normalizeStatus(project?.status?.status) ??
    normalizeStatus(project?.projectStatus) ??
    normalizeStatus(project?.projectStatus?.name) ??
    normalizeStatus(project?.projectStatus?.status) ??
    normalizeStatus(project?.statusName);

  if (directStatus) {
    return directStatus;
  }

  const deletedAt = project?.deletedAt ?? project?.dateDeleted;
  if (deletedAt) {
    return "deleted";
  }

  if (project?.isArchived === true || project?.archived === true) {
    return "archived";
  }
  if (
    project?.completed === true ||
    project?.isCompleted === true ||
    project?.dateCompleted ||
    project?.completedAt
  ) {
    return "completed";
  }

  const dueDateValue = project?.dueDate ?? project?.endDate ?? project?.deadline;
  if (typeof dueDateValue === "string" && dueDateValue.trim()) {
    const dueDate = Date.parse(dueDateValue);
    if (Number.isFinite(dueDate)) {
      const now = Date.now();
      if (dueDate < now) {
        return "late";
      }
      if (dueDate > now) {
        return "upcoming";
      }
    }
  }

  return "active";
}

function matchesStatusFilter(projectStatus: string, requestedStatus: string): boolean {
  const status = normalizeStatus(projectStatus);
  const requested = normalizeStatus(requestedStatus);
  if (!status || !requested) {
    return false;
  }

  if (requested === "active" || requested === "current") {
    return status === "active" || status === "current";
  }
  if (requested === "completed") {
    return status === "completed";
  }
  if (requested === "deleted") {
    return status === "deleted";
  }
  if (requested === "late") {
    return status === "late";
  }
  if (requested === "upcoming") {
    return status === "upcoming";
  }
  return status === requested;
}

// Tool handler
export async function handleGetProjects(input: any) {
  logger.info('=== getProjects tool called ===');
  logger.info(`Query parameters: ${JSON.stringify(input || {})}`);
  
  try {
    const apiInput: Record<string, any> = { ...(input || {}) };
    const statusFilter = normalizeStatus(apiInput.status);
    const includeRaw = Boolean(apiInput.includeRaw);
    delete apiInput.status;
    delete apiInput.includeRaw;

    if (statusFilter && !apiInput.projectStatuses) {
      apiInput.projectStatuses = [statusFilter];
    }
    if (statusFilter && apiInput.status === undefined) {
      apiInput.status = statusFilter;
    }
    if (apiInput.includeProjectStatus === undefined) {
      apiInput.includeProjectStatus = true;
    }

    logger.info('Calling teamworkService.getProjects()');
    const projects = await teamworkService.getProjects(apiInput);
    
    // Debug the response
    logger.info(`Projects response type: ${typeof projects}`);
    
    if (projects === null || projects === undefined) {
      logger.warn('Projects response is null or undefined');
      return {
        content: [{
          type: "text",
          text: "No projects found or API returned empty response."
        }]
      };
    } else if (Array.isArray(projects)) {
      logger.info(`Projects array length: ${projects.length}`);
      if (projects.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No projects found. The API returned an empty array."
          }]
        };
      }
    } else if (typeof projects === 'object') {
      // Check if it's a paginated response with 'projects' property
      if (projects.projects && Array.isArray(projects.projects)) {
        logger.info(`Projects array found in response object. Length: ${projects.projects.length}`);
        if (projects.projects.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No projects found. The API returned an empty projects array."
            }]
          };
        }
      } else {
        logger.info(`Projects response is an object: ${JSON.stringify(projects).substring(0, 200)}...`);
      }
    } else {
      logger.info(`Projects response is not an array or object: ${JSON.stringify(projects).substring(0, 200)}...`);
    }
    
    const allProjectRows = extractProjectsArray(projects).map((project: any) => ({
      id: project?.id ?? null,
      name: project?.name ?? null,
      status: statusFromProject(project)
    }));

    const projectRows = statusFilter
      ? allProjectRows.filter((project) => matchesStatusFilter(project.status, statusFilter))
      : allProjectRows;

    const payload: Record<string, any> = {
      requestedStatus: statusFilter,
      totalBeforeFilter: allProjectRows.length,
      count: projectRows.length,
      projects: projectRows
    };
    if (includeRaw) {
      payload.raw = projects;
    }

    const jsonString = JSON.stringify(payload, null, 2);
    logger.info(`Successfully stringified simplified projects response`);
    logger.info('=== getProjects tool completed successfully ===');
    return {
      content: [{
        type: "text",
        text: jsonString
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Retrieving projects');
  }
} 
