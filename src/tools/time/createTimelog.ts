/**
 * createTimelog tool
 * Logs actual worked time against a specific task in Teamwork.
 */

import logger from '../../utils/logger.js';
import teamworkService from '../../services/index.js';
import { createErrorResponse } from '../../utils/errorHandler.js';

export const createTimelogDefinition = {
  name: 'createTimelog',
  description:
    'Create a timelog entry linked to a task (POST /tasks/{taskId}/time.json). Use this after work is done to log actual time.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'integer',
        description: 'Task ID to log time against.'
      },
      userId: {
        type: 'integer',
        description: 'User ID owning the time entry.'
      },
      hours: {
        type: 'integer',
        description: 'Hours worked. Use 0 if only minutes are logged.'
      },
      minutes: {
        type: 'integer',
        description: 'Minutes worked. Use 0 if only hours are logged.'
      },
      date: {
        type: 'string',
        description: 'Work date in YYYY-MM-DD format.'
      },
      description: {
        type: 'string',
        description: 'What work was done.'
      },
      isBillable: {
        type: 'boolean',
        description: 'Whether this time is billable.'
      },
      time: {
        type: 'string',
        description: 'Optional start time (for example, HH:MM).'
      },
      projectId: {
        type: 'integer',
        description: 'Optional project ID override.'
      },
      ticketId: {
        type: 'integer',
        description: 'Optional ticket ID.'
      },
      tagIds: {
        type: 'array',
        items: {
          type: 'integer'
        },
        description: 'Optional timelog tag IDs.'
      },
      timelogOptions: {
        type: 'object',
        properties: {
          fireWebhook: {
            type: 'boolean'
          },
          logActivity: {
            type: 'boolean'
          },
          markTaskComplete: {
            type: 'boolean'
          },
          parseInlineTags: {
            type: 'boolean'
          },
          useNotifyViaTWIM: {
            type: 'boolean'
          }
        },
        required: [],
        description: 'Optional behavior flags for timelog creation.'
      }
    },
    required: ['taskId', 'userId', 'date', 'description', 'isBillable']
  },
  annotations: {
    title: 'Create Timelog',
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false
  }
};

export async function handleCreateTimelog(input: any) {
  logger.info('Calling teamworkService.createTimelog()');
  try {
    const result = await teamworkService.createTimelog(input ?? {});
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error: any) {
    return createErrorResponse(error, 'Creating timelog');
  }
}

