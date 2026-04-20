import { PayloadUserGroups } from './PayloadUserGroups.js';
import { TaskCustomFields } from './TaskCustomFields.js';
import { PayloadNullableDate } from './PayloadNullableDate.js';
import { PayloadNullableTaskPriority } from './PayloadNullableTaskPriority.js';
import { TaskReminder } from './TaskReminder.js';
import { TaskRepeatOptions } from './TaskRepeatOptions.js';

/**
 * Task contains all the information returned from a task.
 */
export interface TaskTask {
  allocationId?: number;
  assignees?: PayloadUserGroups;
  attachmentIds?: number[];
  changeFollowers?: PayloadUserGroups;
  commentFollowers?: PayloadUserGroups;
  completeFollowers?: PayloadUserGroups;
  completedAt?: string;
  completedBy?: number;
  createdAt?: string;
  createdBy?: number;
  crmDealIds?: number[];
  customFields?: TaskCustomFields;
  description?: string;
  descriptionContentType?: string;
  dueAt?: PayloadNullableDate;
  estimatedMinutes?: number;
  grantAccessTo?: PayloadUserGroups;
  hasDeskTickets?: boolean;
  name?: string;
  notify?: boolean;
  originalDueDate?: PayloadNullableDate;
  parentTaskId?: number;
  priority?: PayloadNullableTaskPriority;
  private?: boolean;
  progress?: number;
  projectId?: number;
  reminders?: TaskReminder[];
  repeatOptions?: TaskRepeatOptions;
  startAt?: PayloadNullableDate;
  status?: string;
  tagIds?: number[];
  taskgroupId?: number;
  tasklistId?: number;
  templateRoleName?: string;
  ticketId?: number;
} 
