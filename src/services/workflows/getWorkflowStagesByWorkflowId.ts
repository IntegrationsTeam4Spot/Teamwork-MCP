import logger from "../../utils/logger.js";
import { ensureApiClient } from "../core/apiClient.js";
import { normalizeWorkflowQueryParams } from "./queryParams.js";

export const getWorkflowStagesByWorkflowId = async (
  workflowId: string,
  params: Record<string, any> = {}
) => {
  try {
    const api = ensureApiClient();
    const normalizedParams = normalizeWorkflowQueryParams(params);
    const response = await api.get(`/workflows/${workflowId}/stages.json`, { params: normalizedParams });
    return response.data;
  } catch (error: any) {
    logger.error(`Error fetching stages for workflow ${workflowId}: ${error.message}`);
    throw new Error(`Failed to fetch stages for workflow ${workflowId}: ${error.message}`);
  }
};

export default getWorkflowStagesByWorkflowId;
