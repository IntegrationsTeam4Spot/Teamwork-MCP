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
  description: "Get projects from Teamwork via GET /projects.json. Optional status filter supported. Status is normalized from Teamwork status/subStatus (inactive -> archived; current/late/upcoming from subStatus). Returns simplified project rows with id, name, and status.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["active", "current", "late", "upcoming", "completed", "deleted", "archived", "inactive"],
        description: "Optional filter. archived/inactive map to Teamwork archived (inactive). active includes active/current/late/upcoming."
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
      onlyArchivedProjects: {
        type: "boolean",
        description: "Return only archived projects."
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

function canonicalizeProjectStatus(value: any): string | null {
  const normalized = normalizeStatus(value);
  if (!normalized) {
    return null;
  }

  if (normalized === "inactive" || normalized === "archived") {
    return "archived";
  }

  return normalized;
}

function statusFromProject(project: any): string {
  const deletedAt = project?.deletedAt ?? project?.dateDeleted;
  if (deletedAt) {
    return "deleted";
  }

  if (
    project?.isArchived === true ||
    project?.archived === true ||
    project?.archivedAt
  ) {
    return "archived";
  }

  const primaryStatus = normalizeStatus(
    project?.status ??
    project?.status?.name ??
    project?.status?.status ??
    project?.projectStatus ??
    project?.projectStatus?.name ??
    project?.projectStatus?.status ??
    project?.statusName
  );
  const subStatus = normalizeStatus(project?.subStatus ?? project?.projectSubStatus);

  // Teamwork archived projects are usually status=inactive.
  if (primaryStatus === "inactive") {
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

  // For active projects, subStatus is the most specific operational state.
  if (subStatus === "late" || subStatus === "upcoming" || subStatus === "current") {
    return subStatus;
  }

  const directStatus = canonicalizeProjectStatus(primaryStatus);
  if (directStatus && directStatus !== "archived") {
    return directStatus;
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
  const status = canonicalizeProjectStatus(projectStatus);
  const requested = canonicalizeProjectStatus(requestedStatus);
  if (!status || !requested) {
    return false;
  }

  if (requested === "active") {
    // "active" means any non-archived active workload state.
    return status === "active" || status === "current" || status === "late" || status === "upcoming";
  }
  if (requested === "archived") {
    return status === "archived";
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

function applyStatusFilterToApiInput(apiInput: Record<string, any>, statusFilter: string | null): void {
  const requested = canonicalizeProjectStatus(statusFilter);
  if (!requested) {
    return;
  }

  // Teamwork archived projects are typically represented with inactive status.
  if (requested === "archived") {
    if (apiInput.includeArchivedProjects === undefined) {
      apiInput.includeArchivedProjects = true;
    }
    if (apiInput.onlyArchivedProjects === undefined) {
      apiInput.onlyArchivedProjects = true;
    }
    return;
  }

  if (requested === "completed" && apiInput.includeCompletedProjects === undefined) {
    apiInput.includeCompletedProjects = true;
  }

  if (requested === "deleted") {
    if (apiInput.includeArchivedProjects === undefined) {
      apiInput.includeArchivedProjects = true;
    }
    if (apiInput.includeCompletedProjects === undefined) {
      apiInput.includeCompletedProjects = true;
    }
  }
}

function buildStatusBreakdown(projectRows: Array<{ status: string | null }>): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const row of projectRows) {
    const key = row.status ?? "unknown";
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }
  return breakdown;
}

async function fetchProjectsWithOptionalPagination(
  apiInput: Record<string, any>,
  statusFilter: string | null
): Promise<any> {
  const shouldAutoPaginate =
    !!statusFilter &&
    apiInput.page === undefined &&
    apiInput.pageSize === undefined;

  if (!shouldAutoPaginate) {
    return teamworkService.getProjects(apiInput);
  }

  const pageSize = 200;
  const maxPages = 50;
  let page = 1;
  const aggregated: any[] = [];
  let firstResponse: any = null;
  let pagesFetched = 0;

  while (page <= maxPages) {
    const response = await teamworkService.getProjects({
      ...apiInput,
      page,
      pageSize
    });
    if (page === 1) {
      firstResponse = response;
    }

    const pageProjects = extractProjectsArray(response);
    aggregated.push(...pageProjects);
    pagesFetched += 1;

    if (pageProjects.length < pageSize) {
      break;
    }
    page += 1;
  }

  if (firstResponse && typeof firstResponse === "object" && !Array.isArray(firstResponse)) {
    return {
      ...firstResponse,
      projects: aggregated,
      _mcpPagination: {
        autoPagination: true,
        pageSize,
        pagesFetched
      }
    };
  }

  return {
    projects: aggregated,
    _mcpPagination: {
      autoPagination: true,
      pageSize,
      pagesFetched
    }
  };
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

    applyStatusFilterToApiInput(apiInput, statusFilter);
    if (statusFilter && apiInput.status === undefined) {
      apiInput.status = canonicalizeProjectStatus(statusFilter) ?? statusFilter;
    }
    if (apiInput.includeProjectStatus === undefined) {
      apiInput.includeProjectStatus = true;
    }

    logger.info('Calling teamworkService.getProjects()');
    const projects = await fetchProjectsWithOptionalPagination(apiInput, statusFilter);
    
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
      requestedStatus: canonicalizeProjectStatus(statusFilter) ?? statusFilter,
      apiReturnedCount: allProjectRows.length,
      statusBreakdown: buildStatusBreakdown(allProjectRows),
      totalBeforeFilter: allProjectRows.length,
      count: projectRows.length,
      projects: projectRows
    };
    if ((projects as any)?._mcpPagination) {
      payload.pagination = (projects as any)._mcpPagination;
    }
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
