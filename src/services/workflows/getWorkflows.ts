import logger from "../../utils/logger.js";
import { ensureApiClient } from "../core/apiClient.js";
import { normalizeWorkflowQueryParams } from "./queryParams.js";

export interface GetWorkflowsParams {
  updatedAfter?: string;
  status?: string;
  searchTerm?: string;
  cursor?: string;
  pageSize?: number;
  page?: number;
  limit?: number;
  showDeleted?: boolean;
  onlyDefaultWorkflow?: boolean;
  matchAllStageNames?: boolean;
  includeTotalCount?: boolean;
  includeArchived?: boolean;
  workflowIds?: number[];
  stageNames?: string[];
  projectIds?: number[];
  include?: string[];
  "fields[workflows]"?: string[];
  "fields[users]"?: string[];
  "fields[teams]"?: string[];
  "fields[stages]"?: string[];
  "fields[projects]"?: string[];
  "fields[companies]"?: string[];
  [key: string]: any;
}

export const getWorkflows = async (params: GetWorkflowsParams = {}) => {
  try {
    const api = ensureApiClient();
    const normalizedParams = normalizeWorkflowQueryParams(params);
    const response = await api.get("/workflows.json", { params: normalizedParams });
    return response.data;
  } catch (error: any) {
    logger.error(`Error fetching workflows: ${error.message}`);
    throw new Error(`Failed to fetch workflows: ${error.message}`);
  }
};

export default getWorkflows;
