/**
 * getWorkflowStages tool
 * Retrieves stage lookup values for a workflow in a project
 */

import fs from "fs";
import path from "path";
import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";

export const getWorkflowStagesDefinition = {
  name: "getWorkflowStages",
  description: "Get stage names and IDs for a Teamwork workflow. Provide workflowId (preferred) or workflowName. If omitted, returns stages for all workflows in the project.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        description: "Optional Teamwork project ID. If omitted, resolves from .teamwork, teamwork.config.json, or TEAMWORK_PROJECT_ID."
      },
      workflowId: {
        type: "integer",
        description: "Optional workflow ID to return only stages in that workflow. Preferred for deterministic results."
      },
      workflowName: {
        type: "string",
        description: "Optional workflow name filter (case-insensitive). If numeric (for example \"2205\"), it is treated as workflowId."
      },
      stageName: {
        type: "string",
        description: "Optional stage name filter (case-insensitive)."
      }
    }
  },
  annotations: {
    title: "Get Workflow Stages",
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

export async function handleGetWorkflowStages(input: any) {
  try {
    const projectId = resolveCurrentProjectId(input);
    if (!projectId) {
      throw new Error("Project ID could not be resolved. Provide projectId or configure .teamwork/teamwork.config.json/TEAMWORK_PROJECT_ID.");
    }

    const workflowIdFromInput = toId(input?.workflowId);
    const workflowNameInput = typeof input?.workflowName === "string" ? input.workflowName.trim() : "";
    const workflowIdFromWorkflowName = toId(workflowNameInput);
    const workflowNameFilter = workflowIdFromWorkflowName !== undefined ? "" : normalizeName(workflowNameInput);
    const stageNameFilter = normalizeName(input?.stageName);

    const effectiveWorkflowId = workflowIdFromInput ?? workflowIdFromWorkflowName;
    const lookup = await teamworkService.getProjectWorkflowStages(String(projectId));

    let workflows = lookup.workflows;
    let stages = lookup.stages;

    if (effectiveWorkflowId !== undefined) {
      workflows = workflows.filter((workflow: any) => workflow.id === effectiveWorkflowId);
      stages = stages.filter((stage: any) => stage.workflowId === effectiveWorkflowId);
    } else if (workflowNameFilter) {
      workflows = workflows.filter((workflow: any) => normalizeName(workflow.name) === workflowNameFilter);
      if (workflows.length === 0) {
        const available = lookup.workflows.map((workflow: any) => workflow.name).join(", ");
        throw new Error(
          available
            ? `Workflow '${workflowNameInput}' was not found in project ${projectId}. Available workflows: ${available}`
            : `Workflow '${workflowNameInput}' was not found in project ${projectId}.`
        );
      }

      const workflowIds = new Set(workflows.map((workflow: any) => workflow.id));
      stages = stages.filter((stage: any) => stage.workflowId !== undefined && workflowIds.has(stage.workflowId));
    }

    if (stageNameFilter) {
      stages = stages.filter((stage: any) => normalizeName(stage.name) === stageNameFilter);
    }

    const workflowsById = new Map<number, any>(workflows.map((workflow: any) => [workflow.id, workflow]));
    const stagesWithWorkflow = stages.map((stage: any) => ({
      id: stage.id,
      name: stage.name,
      workflowId: stage.workflowId ?? null,
      workflowName: stage.workflowName ?? (stage.workflowId ? workflowsById.get(stage.workflowId)?.name ?? null : null)
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          projectId: lookup.projectId,
          projectName: lookup.projectName ?? null,
          workflowId: effectiveWorkflowId ?? null,
          workflowName: workflowNameInput || null,
          stages: stagesWithWorkflow
        }, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, "Getting workflow stages");
  }
}

