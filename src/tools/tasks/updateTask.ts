/**
 * updateTask tool
 * Updates an existing task in Teamwork
 */

import logger from "../../utils/logger.js";
import teamworkService from "../../services/index.js";
import { TaskRequest } from "../../models/TaskRequest.js";
import { createErrorResponse } from "../../utils/errorHandler.js";
import { resolveWorkflowStageByNameForTask } from "./taskLookup.js";
import fs from "fs";
import path from "path";

// Tool definition
export const updateTaskDefinition = {
  name: "updateTask",
  description: "Update an existing task. Supports direct field updates and workflow-stage moves. For deterministic stage moves, resolve IDs first with getWorkflowStages/getProjectWorkflowStages, then pass workflowStageId/stageId.",
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'integer',
        description: 'The ID of the task to update'
      },
      projectId: {
        type: 'integer',
        description: 'Optional Teamwork project ID used as fallback context when resolving workflow/stage names to IDs'
      },
      workflowId: {
        type: 'integer',
        description: 'Optional existing workflow ID shortcut. Mapped to taskRequest.workflows.workflowId. Prefer this over workflowName when possible.'
      },
      workflowStageId: {
        type: 'integer',
        description: 'Optional existing workflow stage ID shortcut. Mapped to taskRequest.workflows.stageId. Preferred for deterministic updates. You can find this with getWorkflowStages.'
      },
      workflowName: {
        type: 'string',
        description: 'Optional existing workflow name. Tool resolves this to workflowId before update. If a numeric string is provided (e.g. "2205"), it is treated as workflowId.'
      },
      stageName: {
        type: 'string',
        description: 'Optional existing stage name/label. Tool resolves this to stageId before update, using closest match fallback when needed.'
      },
      taskRequest: {
        type: 'object',
        properties: {
          attachmentOptions: {
            type: 'object',
            properties: {
              removeOtherFiles: {
                type: 'boolean'
              }
            },
            required: []
          },
          attachments: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    categoryId: {
                      type: 'integer'
                    },
                    id: {
                      type: 'integer'
                    }
                  },
                  required: [],
                  description: 'File stores information about a uploaded file.'
                }
              },
              pendingFiles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    categoryId: {
                      type: 'integer'
                    },
                    reference: {
                      type: 'string'
                    }
                  },
                  required: [],
                  description: 'PendingFile stores information about a file uploaded on-the-fly.'
                }
              }
            },
            required: []
          },
          card: {
            type: 'object',
            properties: {
              columnId: {
                type: 'integer'
              }
            },
            required: [],
            description: 'Card stores information about the card created with the task.'
          },
          predecessors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer'
                },
                type: {
                  type: 'string'
                }
              },
              required: [],
              description: 'Predecessor stores information about task predecessors.'
            }
          },
          tags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                color: {
                  type: 'string'
                },
                name: {
                  type: 'string'
                },
                projectId: {
                  type: 'integer'
                }
              },
              required: [],
              description: 'Tag contains all the information returned from a tag.'
            }
          },
          task: {
            type: 'object',
            properties: {
              assignees: {
                type: 'object',
                properties: {
                  companyIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  teamIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  userIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  }
                },
                required: [],
                description: 'UserGroups are common lists for storing users, companies and teams ids together.'
              },
              attachmentIds: {
                type: 'array',
                items: {
                  type: 'integer'
                }
              },
              changeFollowers: {
                type: 'object',
                properties: {
                  companyIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  teamIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  userIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  }
                },
                required: [],
                description: 'UserGroups are common lists for storing users, companies and teams ids together.'
              },
              commentFollowers: {
                type: 'object',
                properties: {
                  companyIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  teamIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  userIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  }
                },
                required: [],
                description: 'UserGroups are common lists for storing users, companies and teams ids together.'
              },
              completedAt: {
                type: 'string'
              },
              completedBy: {
                type: 'integer'
              },
              createdAt: {
                type: 'string'
              },
              createdBy: {
                type: 'integer'
              },
              crmDealIds: {
                type: 'array',
                items: {
                  type: 'integer'
                }
              },
              customFields: {
                type: 'object',
                properties: {
                  Values: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        countryCode: {
                          type: 'string'
                        },
                        currencySymbol: {
                          type: 'string'
                        },
                        customfieldId: {
                          type: 'integer'
                        },
                        urlTextToDisplay: {
                          type: 'string'
                        },
                        value: {
                          type: 'string'
                        }
                      },
                      required: [],
                      description: 'CustomFieldValue contains all the information returned from a customfield.'
                    }
                  }
                },
                required: [],
                description: 'CustomFields is the custom fields type.'
              },
              description: {
                type: 'string'
              },
              descriptionContentType: {
                type: 'string'
              },
              dueAt: {
                type: 'string',
                format: 'date',
                description: 'NullableDate implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted. Date format \'2006-01-02\''
              },
              estimatedMinutes: {
                type: 'integer'
              },
              grantAccessTo: {
                type: 'object',
                properties: {
                  companyIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  teamIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  userIds: {
                    type: 'array',
                    items: {
                      type: 'integer'
                    },
                    description: 'NullableInt64Slice implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  }
                },
                required: [],
                description: 'UserGroups are common lists for storing users, companies and teams ids together.'
              },
              hasDeskTickets: {
                type: 'boolean'
              },
              name: {
                type: 'string'
              },
              originalDueDate: {
                type: 'string',
                format: 'date',
                description: 'NullableDate implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted. Date format \'2006-01-02\''
              },
              parentTaskId: {
                type: 'integer'
              },
              priority: {
                type: 'string',
                enum: [
                  'low',
                  'normal',
                  'high'
                ],
                description: 'NullableTaskPriority implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
              },
              private: {
                type: 'boolean'
              },
              progress: {
                type: 'integer'
              },
              reminders: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    isRelative: {
                      type: 'boolean'
                    },
                    note: {
                      type: 'string'
                    },
                    relativeNumberDays: {
                      type: 'integer'
                    },
                    remindAt: {
                      type: 'string'
                    },
                    type: {
                      type: 'string'
                    },
                    userId: {
                      type: 'integer'
                    }
                  },
                  required: [],
                  description: 'Reminder stores all necessary information to create a task reminder.'
                }
              },
              repeatOptions: {
                type: 'object',
                properties: {
                  duration: {
                    type: 'integer'
                  },
                  editOption: {
                    type: 'string'
                  },
                  endsAt: {
                    type: 'string',
                    format: 'date',
                    description: 'NullableDate implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted. Date format \'2006-01-02\''
                  },
                  frequency: {
                    type: 'object',
                    description: 'NullableTaskRepeatFrequency implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  monthlyRepeatType: {
                    type: 'object',
                    description: 'NullableTaskRepeatMonthlyType implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  },
                  rrule: {
                    type: 'string',
                    description: 'Adds the RRule definition for repeating tasks. It replaces all other repeating fields.'
                  },
                  selectedDays: {
                    type: 'object',
                    description: 'NullableWorkingHourEntryWeekdays implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted.'
                  }
                },
                required: [],
                description: 'RepeatOptions stores recurring information for the task.'
              },
              startAt: {
                type: 'string',
                format: 'date',
                description: 'NullableDate implements json.Unmarshaler to allow testing between a value that explicitly set to null or omitted. Date format \'2006-01-02\''
              },
              status: {
                type: 'string'
              },
              tagIds: {
                type: 'array',
                items: {
                  type: 'integer'
                }
              },
              taskgroupId: {
                type: 'integer'
              },
              tasklistId: {
                type: 'integer'
              },
              templateRoleName: {
                type: 'string'
              },
              ticketId: {
                type: 'integer'
              }
            },
            required: [],
            description: 'Task contains all the information returned from a task.'
          },
          taskOptions: {
            type: 'object',
            properties: {
              appendAssignees: {
                type: 'boolean'
              },
              checkInvalidusers: {
                type: 'boolean'
              },
              everyoneMustDo: {
                type: 'boolean'
              },
              fireWebhook: {
                type: 'boolean'
              },
              isTemplate: {
                type: 'boolean'
              },
              logActivity: {
                type: 'boolean'
              },
              notify: {
                type: 'boolean'
              },
              parseInlineTags: {
                type: 'boolean'
              },
              positionAfterTaskId: {
                type: 'integer'
              },
              pushDependents: {
                type: 'boolean'
              },
              pushSubtasks: {
                type: 'boolean'
              },
              shiftProjectDates: {
                type: 'boolean'
              },
              useDefaults: {
                type: 'boolean'
              },
              useNotifyViaTWIM: {
                type: 'boolean'
              }
            },
            required: [],
            description: 'Options contains any options which can be set for the task request'
          },
          workflows: {
            type: 'object',
            properties: {
              positionAfterTask: {
                type: 'integer'
              },
              stageId: {
                type: 'integer'
              },
              workflowStageId: {
                type: 'integer',
                description: 'Alias of stageId; will be normalized to stageId before update'
              },
              workflowId: {
                type: 'integer'
              }
            },
            required: [],
            description: 'Workflows stores information about where the task lives in the workflow'
          }
        },
        required: [],
        description: 'The task data to update'
      }
    },
    required: ['taskId']
  },
  annotations: {
    title: "Update a Task",
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function parseOptionalInteger(value: any): number | undefined {
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

function getStageDisplayName(stage: any): string {
  if (typeof stage?.name === "string" && stage.name.trim()) {
    return stage.name.trim();
  }
  if (typeof stage?.stage === "string" && stage.stage.trim()) {
    return stage.stage.trim();
  }
  return "";
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
  );
}

function scoreNameMatch(targetRaw: string, candidateRaw: string): number {
  const target = normalizeName(targetRaw);
  const candidate = normalizeName(candidateRaw);

  if (!target || !candidate) {
    return 0;
  }
  if (target === candidate) {
    return 1000;
  }

  const targetCompact = target.replace(/[^a-z0-9]/g, "");
  const candidateCompact = candidate.replace(/[^a-z0-9]/g, "");
  if (targetCompact && targetCompact === candidateCompact) {
    return 950;
  }
  if (candidate.startsWith(target) || target.startsWith(candidate)) {
    return 850;
  }
  if (candidate.includes(target) || target.includes(candidate)) {
    return 750;
  }

  const targetTokens = tokenSet(target);
  const candidateTokens = tokenSet(candidate);
  if (targetTokens.size === 0 || candidateTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of targetTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  }

  if (overlap === 0) {
    return 0;
  }

  const jaccard = overlap / (targetTokens.size + candidateTokens.size - overlap);
  return Math.round(jaccard * 700);
}

function bestNameMatch<T>(
  target: string,
  candidates: T[],
  nameSelector: (item: T) => string
): { match?: T; score: number; ties: number } {
  let winner: T | undefined;
  let bestScore = 0;
  let ties = 0;

  for (const candidate of candidates) {
    const candidateName = nameSelector(candidate);
    const score = scoreNameMatch(target, candidateName);
    if (score > bestScore) {
      winner = candidate;
      bestScore = score;
      ties = 1;
    } else if (score > 0 && score === bestScore) {
      ties += 1;
    }
  }

  return { match: winner, score: bestScore, ties };
}

function extractProjectIdFromTeamworkFile(filePath: string): string | null {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/PROJECTID=(\d+)/i);
  return match ? String(parseInt(match[1], 10)) : null;
}

function extractProjectIdFromConfig(filePath: string): string | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const config = JSON.parse(raw);
  if (config?.teamworkProjectId !== undefined && config?.teamworkProjectId !== null && String(config.teamworkProjectId).trim() !== "") {
    return String(config.teamworkProjectId);
  }
  if (config?.projectId !== undefined && config?.projectId !== null && String(config.projectId).trim() !== "") {
    return String(config.projectId);
  }
  return null;
}

function resolveWorkspaceProjectId(inputProjectId?: number): number | undefined {
  if (inputProjectId !== undefined) {
    return inputProjectId;
  }

  const roots = [process.env.SOLUTION_ROOT_PATH, process.cwd()].filter((value): value is string => !!value);
  for (const root of roots) {
    const teamworkPath = path.resolve(root, ".teamwork");
    if (fs.existsSync(teamworkPath)) {
      try {
        const projectId = extractProjectIdFromTeamworkFile(teamworkPath);
        const parsed = parseOptionalInteger(projectId);
        if (parsed) {
          return parsed;
        }
      } catch (error: any) {
        logger.warn(`Failed reading ${teamworkPath}: ${error.message}`);
      }
    }

    const configPath = path.resolve(root, "teamwork.config.json");
    if (fs.existsSync(configPath)) {
      try {
        const projectId = extractProjectIdFromConfig(configPath);
        const parsed = parseOptionalInteger(projectId);
        if (parsed) {
          return parsed;
        }
      } catch (error: any) {
        logger.warn(`Failed reading ${configPath}: ${error.message}`);
      }
    }
  }

  return parseOptionalInteger(process.env.TEAMWORK_PROJECT_ID);
}

async function resolveNamesFromProjectLookup(
  projectId: number,
  options: {
    workflowId?: number;
    workflowName?: string;
    stageName?: string;
  }
): Promise<{ workflowId?: number; workflowName?: string; stageId?: number; stageName?: string }> {
  const lookup = await teamworkService.getProjectWorkflowStages(String(projectId));

  let workflows = lookup.workflows ?? [];
  let stages = lookup.stages ?? [];

  if (options.workflowId !== undefined) {
    workflows = workflows.filter((workflow: any) => workflow.id === options.workflowId);
    stages = stages.filter((stage: any) => stage.workflowId === options.workflowId);
  }

  let resolvedWorkflowId = options.workflowId;
  let resolvedWorkflowName: string | undefined;

  if (options.workflowName) {
    const workflowMatch = bestNameMatch(options.workflowName, workflows, (workflow: any) => String(workflow.name ?? ""));
    if (!workflowMatch.match || workflowMatch.score < 450) {
      const available = workflows.map((workflow: any) => workflow.name).filter((name: any) => typeof name === "string").join(", ");
      throw new Error(
        available
          ? `Workflow '${options.workflowName}' was not found in project ${projectId}. Available workflows: ${available}`
          : `Workflow '${options.workflowName}' was not found in project ${projectId}.`
      );
    }
    if (workflowMatch.ties > 1 && workflowMatch.score < 1000) {
      throw new Error(`Workflow '${options.workflowName}' is ambiguous in project ${projectId}. Please provide workflowId.`);
    }

    resolvedWorkflowId = workflowMatch.match.id;
    resolvedWorkflowName = workflowMatch.match.name;
    stages = stages.filter((stage: any) => stage.workflowId === resolvedWorkflowId);
  } else if (resolvedWorkflowId !== undefined) {
    const workflow = workflows.find((item: any) => item.id === resolvedWorkflowId);
    resolvedWorkflowName = workflow?.name;
  }

  if (!options.stageName) {
    return {
      workflowId: resolvedWorkflowId,
      workflowName: resolvedWorkflowName
    };
  }

  const stageCandidates = stages.map((stage: any) => ({
    ...stage,
    _displayName: getStageDisplayName(stage)
  })).filter((stage: any) => stage._displayName);

  const stageMatch = bestNameMatch(options.stageName, stageCandidates, (stage: any) => stage._displayName);
  if (!stageMatch.match || stageMatch.score < 450) {
    const available = stageCandidates.map((stage: any) => stage._displayName).join(", ");
    throw new Error(
      available
        ? `Stage '${options.stageName}' was not found in project ${projectId}. Available stages: ${available}`
        : `Stage '${options.stageName}' was not found in project ${projectId}.`
    );
  }
  if (stageMatch.ties > 1 && stageMatch.score < 1000) {
    throw new Error(`Stage '${options.stageName}' is ambiguous in project ${projectId}. Please provide workflowName or workflowId.`);
  }

  const resolvedStageId = parseOptionalInteger(stageMatch.match.id);
  const resolvedStageName = stageMatch.match._displayName;

  if (!resolvedWorkflowId && stageMatch.match.workflowId) {
    resolvedWorkflowId = parseOptionalInteger(stageMatch.match.workflowId);
    const workflow = (lookup.workflows ?? []).find((item: any) => item.id === resolvedWorkflowId);
    resolvedWorkflowName = workflow?.name ?? resolvedWorkflowName;
  }

  return {
    workflowId: resolvedWorkflowId,
    workflowName: resolvedWorkflowName,
    stageId: resolvedStageId,
    stageName: resolvedStageName
  };
}

// Tool handler
export async function handleUpdateTask(input: any) {
  logger.verbose("=== updateTask tool called ===");  
  try {
    
    const taskId = input.taskId;
    const taskRequest = (input.taskRequest ?? {}) as TaskRequest;
    const projectIdFallback = parseOptionalInteger(input.projectId);
    const workflowIdShortcut = parseOptionalInteger(input.workflowId);
    const workflowStageIdShortcut = parseOptionalInteger(input.workflowStageId);
    const workflowNameInput = typeof input.workflowName === "string" ? input.workflowName.trim() : undefined;
    const workflowIdFromWorkflowName = parseOptionalInteger(workflowNameInput);
    const workflowName = workflowIdFromWorkflowName !== undefined ? undefined : workflowNameInput;
    const stageName = typeof input.stageName === "string" ? input.stageName.trim() : undefined;

    if (!taskId) {
      logger.error("Invalid request: missing taskId");
      return {
        content: [{
          type: "text",
          text: "Invalid request: missing taskId. Please provide a taskId."
        }]
      };
    }

    taskRequest.workflows = taskRequest.workflows ?? {};
    const workflowsAny = taskRequest.workflows as any;
    const nestedWorkflowStageId = parseOptionalInteger(workflowsAny.workflowStageId);
    const nestedStageId = parseOptionalInteger(workflowsAny.stageId);
    const nestedWorkflowId = parseOptionalInteger(workflowsAny.workflowId);

    const effectiveWorkflowId = workflowIdShortcut ?? workflowIdFromWorkflowName;

    if (effectiveWorkflowId !== undefined) {
      taskRequest.workflows.workflowId = effectiveWorkflowId;
    } else if (nestedWorkflowId !== undefined) {
      taskRequest.workflows.workflowId = nestedWorkflowId;
    }

    if (workflowStageIdShortcut !== undefined) {
      taskRequest.workflows.stageId = workflowStageIdShortcut;
    } else if (nestedStageId !== undefined) {
      taskRequest.workflows.stageId = nestedStageId;
    } else if (nestedWorkflowStageId !== undefined) {
      taskRequest.workflows.stageId = nestedWorkflowStageId;
    }

    if ("workflowStageId" in workflowsAny) {
      delete workflowsAny.workflowStageId;
    }

    if (Object.keys(taskRequest.workflows).length === 0) {
      delete (taskRequest as any).workflows;
    }

    const hasTaskContent = !!taskRequest.task || !!taskRequest.workflows;
    const hasNameBasedWorkflowInput = !!workflowName || !!stageName;

    if (!hasTaskContent && !hasNameBasedWorkflowInput) {
      return {
        content: [{
          type: "text",
          text: "Invalid request: provide taskRequest content and/or workflowStageId/workflowId and/or workflowName/stageName."
        }]
      };
    }

    if (hasNameBasedWorkflowInput) {
      taskRequest.workflows = taskRequest.workflows ?? {};
      const preferredWorkflowId = parseOptionalInteger(taskRequest.workflows.workflowId);

      let resolved:
        | { workflowId?: number; workflowName?: string; stageId?: number; stageName?: string }
        | undefined;

      try {
        resolved = await resolveWorkflowStageByNameForTask(taskId, workflowName, stageName);
      } catch (primaryError: any) {
        logger.warn(`Task-scoped workflow/stage name resolution failed for task ${taskId}: ${primaryError.message}`);

        const projectId = resolveWorkspaceProjectId(projectIdFallback);
        if (!projectId) {
          throw new Error(
            `${primaryError.message}\n\n` +
            "Name-based stage/workflow updates need project context when task lookup cannot resolve it. " +
            "Provide projectId (or configure TEAMWORK_PROJECT_ID/.teamwork/teamwork.config.json), " +
            "or update by workflowStageId/stageId directly."
          );
        }

        resolved = await resolveNamesFromProjectLookup(projectId, {
          workflowId: preferredWorkflowId,
          workflowName,
          stageName
        });

        logger.info(
          `Resolved workflow/stage by project lookup for task ${taskId} (project ${projectId}): ` +
          `workflow='${resolved.workflowName ?? "n/a"}' (${resolved.workflowId ?? "n/a"}), ` +
          `stage='${resolved.stageName ?? "n/a"}' (${resolved.stageId ?? "n/a"})`
        );
      }

      if (resolved.workflowId !== undefined) {
        taskRequest.workflows.workflowId = resolved.workflowId;
      }
      if (resolved.stageId !== undefined) {
        taskRequest.workflows.stageId = resolved.stageId;
      }

      logger.info(
        `Resolved workflow/stage by name for task ${taskId}: ` +
        `workflow='${resolved.workflowName ?? "n/a"}' (${resolved.workflowId ?? "n/a"}), ` +
        `stage='${resolved.stageName ?? "n/a"}' (${resolved.stageId ?? "n/a"})`
      );
    }

    // Call the service to update the task
    const response = await teamworkService.updateTask(taskId.toString(), taskRequest);
       
    return {
      content: [{
        type: "text",
        text: JSON.stringify(response, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Updating task');
  }
} 
