import logger from '../../utils/logger.js';
import { ensureApiClient } from '../core/apiClient.js';

export interface CreateTimelogParams {
  taskId: number;
  userId: number;
  hours?: number;
  minutes?: number;
  date: string;
  description: string;
  isBillable: boolean;
  time?: string;
  projectId?: number;
  ticketId?: number;
  tagIds?: number[];
  timelogOptions?: {
    fireWebhook?: boolean;
    logActivity?: boolean;
    markTaskComplete?: boolean;
    parseInlineTags?: boolean;
    useNotifyViaTWIM?: boolean;
  };
}

function toInteger(value: any, fieldName: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  throw new Error(`Invalid ${fieldName}: expected an integer.`);
}

/**
 * Creates a timelog linked to a specific task.
 * Endpoint: POST /projects/api/v3/tasks/{taskId}/time.json
 */
export const createTimelog = async (params: CreateTimelogParams) => {
  try {
    const taskId = toInteger(params.taskId, 'taskId');
    const userId = toInteger(params.userId, 'userId');
    const hours = params.hours !== undefined ? toInteger(params.hours, 'hours') : 0;
    const minutes = params.minutes !== undefined ? toInteger(params.minutes, 'minutes') : 0;

    if (hours < 0 || minutes < 0) {
      throw new Error('Invalid duration: hours/minutes cannot be negative.');
    }
    if (hours === 0 && minutes === 0) {
      throw new Error('Invalid duration: provide hours and/or minutes greater than 0.');
    }
    if (!params.date || typeof params.date !== 'string') {
      throw new Error('Invalid date: expected a date string (YYYY-MM-DD).');
    }
    if (!params.description || typeof params.description !== 'string') {
      throw new Error('Invalid description: expected a non-empty string.');
    }
    if (typeof params.isBillable !== 'boolean') {
      throw new Error('Invalid isBillable: expected true or false.');
    }

    const timelog: Record<string, any> = {
      taskId,
      userId,
      hours,
      minutes,
      date: params.date,
      description: params.description,
      isBillable: params.isBillable
    };

    if (params.time !== undefined) timelog.time = params.time;
    if (params.projectId !== undefined) timelog.projectId = toInteger(params.projectId, 'projectId');
    if (params.ticketId !== undefined) timelog.ticketId = toInteger(params.ticketId, 'ticketId');
    if (params.tagIds !== undefined) timelog.tagIds = params.tagIds.map((id) => toInteger(id, 'tagIds[]'));

    const payload: Record<string, any> = { timelog };
    if (params.timelogOptions && typeof params.timelogOptions === 'object') {
      payload.timelogOptions = params.timelogOptions;
    }

    const api = ensureApiClient();
    const response = await api.post(`/tasks/${taskId}/time.json`, payload);
    return response.data;
  } catch (error: any) {
    logger.error(`Failed to create timelog: ${error.message}`);
    if (error?.response?.data) {
      logger.error(`Create timelog API response: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to create timelog: ${error.message}`);
  }
};

export default createTimelog;
