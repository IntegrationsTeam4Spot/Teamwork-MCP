import logger from "../../utils/logger.js";
import { ensureApiClient } from "../core/apiClient.js";

export const getWorkflowStageById = async (workflowId: string, stageId: string) => {
  try {
    const api = ensureApiClient();
    const response = await api.get(`/workflows/${workflowId}/stages/${stageId}.json`);
    return response.data;
  } catch (error: any) {
    logger.error(`Error fetching stage ${stageId} for workflow ${workflowId}: ${error.message}`);
    throw new Error(`Failed to fetch stage ${stageId} for workflow ${workflowId}: ${error.message}`);
  }
};

export default getWorkflowStageById;
