/**
 * getProjectWorkflowStages tool
 * Retrieves workflow and stage lookup values for a project
 */

import fs from "fs";
import path from "path";
import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const getProjectWorkflowStagesDefinition = {
  name: "getProjectWorkflowStages",
  description: "Get all workflow and stage names/IDs for a Teamwork project. Use this to resolve workflowStageId/stageId before updating tasks.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        description: "Optional Teamwork project ID. If omitted, resolves from .teamwork, teamwork.config.json, or TEAMWORK_PROJECT_ID."
      },
      workflowId: {
        type: "integer",
        description: "Optional filter: return only this workflow ID."
      },
      stageId: {
        type: "integer",
        description: "Optional filter: return only this stage ID."
      },
      workflowName: {
        type: "string",
        description: "Optional case-insensitive workflow-name filter."
      },
      stageName: {
        type: "string",
        description: "Optional case-insensitive stage-name filter."
      }
    }
  },
  annotations: {
    title: "Get Project Workflow Stages",
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false
  }
};

function toId(value: any): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
  }
  return undefined;
}

function normalizeName(value: any): string {
  return String(value ?? "").trim().toLowerCase();
}

function extractProjectIdFromTeamworkFile(filePath: string): string | null {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/PROJECTID=(\d+)/i);
  return match ? String(parseInt(match[1], 10)) : null;
}

function extractProjectIdFromConfig(filePath: string): string | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const config = JSON.parse(raw);

  const teamworkProjectId = config?.teamworkProjectId;
  if (teamworkProjectId !== undefined && teamworkProjectId !== null && String(teamworkProjectId).trim() !== "") {
    return String(teamworkProjectId);
  }

  const projectId = config?.projectId;
  if (projectId !== undefined && projectId !== null && String(projectId).trim() !== "") {
    return String(projectId);
  }

  return null;
}

function resolveCurrentProjectId(input: any): string | null {
  if (input?.projectId !== undefined && input?.projectId !== null && String(input.projectId).trim() !== "") {
    return String(input.projectId);
  }

  const roots = [process.env.SOLUTION_ROOT_PATH, process.cwd()].filter((value): value is string => !!value);
  for (const root of roots) {
    const teamworkPath = path.resolve(root, ".teamwork");
    if (fs.existsSync(teamworkPath)) {
      try {
        const projectId = extractProjectIdFromTeamworkFile(teamworkPath);
        if (projectId) {
          return projectId;
        }
      } catch (error: any) {
        logger.warn(`Failed reading ${teamworkPath}: ${error.message}`);
      }
    }

    const configPath = path.resolve(root, "teamwork.config.json");
    if (fs.existsSync(configPath)) {
      try {
        const projectId = extractProjectIdFromConfig(configPath);
        if (projectId) {
          return projectId;
        }
      } catch (error: any) {
        logger.warn(`Failed reading ${configPath}: ${error.message}`);
      }
    }
  }

  if (process.env.TEAMWORK_PROJECT_ID && process.env.TEAMWORK_PROJECT_ID.trim() !== "") {
    return process.env.TEAMWORK_PROJECT_ID.trim();
  }

  return null;
}

export async function handleGetProjectWorkflowStages(input: any) {
  try {
    const projectId = resolveCurrentProjectId(input);
    if (!projectId) {
      throw new Error("Project ID could not be resolved. Provide projectId or configure .teamwork/teamwork.config.json/TEAMWORK_PROJECT_ID.");
    }

    const workflowIdFilter = toId(input?.workflowId);
    const stageIdFilter = toId(input?.stageId);
    const workflowNameFilter = normalizeName(input?.workflowName);
    const stageNameFilter = normalizeName(input?.stageName);

    const lookup = await teamworkService.getProjectWorkflowStages(String(projectId));

    let workflows = lookup.workflows;
    let stages = lookup.stages;

    if (workflowIdFilter !== undefined) {
      workflows = workflows.filter((workflow: any) => workflow.id === workflowIdFilter);
      stages = stages.filter((stage: any) => stage.workflowId === workflowIdFilter);
    }

    if (workflowNameFilter) {
      workflows = workflows.filter((workflow: any) => normalizeName(workflow.name) === workflowNameFilter);
      const workflowIds = new Set(workflows.map((workflow: any) => workflow.id));
      stages = stages.filter((stage: any) => stage.workflowId !== undefined && workflowIds.has(stage.workflowId));
    }

    if (stageIdFilter !== undefined) {
      stages = stages.filter((stage: any) => stage.id === stageIdFilter);
      const stageWorkflowIds = new Set(
        stages
          .map((stage: any) => stage.workflowId)
          .filter((id: any): id is number => typeof id === "number")
      );
      workflows = workflows.filter((workflow: any) => stageWorkflowIds.has(workflow.id));
    }

    if (stageNameFilter) {
      stages = stages.filter((stage: any) => normalizeName(stage.name) === stageNameFilter);
      const stageWorkflowIds = new Set(
        stages
          .map((stage: any) => stage.workflowId)
          .filter((id: any): id is number => typeof id === "number")
      );
      workflows = workflows.filter((workflow: any) => stageWorkflowIds.has(workflow.id));
    }

    const workflowsById = new Map<number, any>(workflows.map((workflow: any) => [workflow.id, workflow]));
    const workflowsWithStages = workflows.map((workflow: any) => ({
      ...workflow,
      stages: stages.filter((stage: any) => stage.workflowId === workflow.id)
    }));

    const unmatchedStages = stages.filter((stage: any) => !stage.workflowId || !workflowsById.has(stage.workflowId));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          projectId: lookup.projectId,
          projectName: lookup.projectName ?? null,
          filtersApplied: {
            workflowId: workflowIdFilter ?? null,
            stageId: stageIdFilter ?? null,
            workflowName: workflowNameFilter || null,
            stageName: stageNameFilter || null
          },
          workflows: workflowsWithStages,
          stagesWithoutWorkflow: unmatchedStages
        }, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, "Getting project workflow stages");
  }
}

