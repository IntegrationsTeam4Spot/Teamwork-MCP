/**
 * getCurrentProjectId tool
 * Retrieves the current Teamwork project ID for the solution
 */

import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { createErrorResponse } from "../../utils/errorHandler.js";
import fs from "fs";
import path from "path";

// Tool definition
export const getCurrentProjectDefinition = {
  name: "getCurrentProject",
  description: "Get the current solution's Teamwork project. If projectId is not provided, it will be resolved from .teamwork, teamwork.config.json, or TEAMWORK_PROJECT_ID.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        description: "The current Teamwork project ID associated with the solution."
      }
    }
  },
  annotations: {
    title: "Get the Current Project",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

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

// Tool handler
export async function handleGetCurrentProject(input: any) {

  try {
    
    const projectId = resolveCurrentProjectId(input);
    if (!projectId) {
      throw new Error("Project ID could not be resolved. Provide projectId or configure .teamwork/teamwork.config.json/TEAMWORK_PROJECT_ID.");
    }
    
    const result = await teamworkService.getCurrentProject(projectId);
       
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Retrieving current project');
  }
} 
