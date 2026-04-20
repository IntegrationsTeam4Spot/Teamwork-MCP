import logger from "../../utils/logger.js";
import { ensureApiClient } from "../core/apiClient.js";

export const updateWorkflowStage = async (
  workflowId: string,
  stageId: string,
  payload: Record<string, any>
) => {
  try {
    const api = ensureApiClient();
    const response = await api.patch(
      `/workflows/${workflowId}/stages/${stageId}.json`,
      payload
    );
    return response.data;
  } catch (error: any) {
    logger.error(`Error updating workflow stage ${stageId} in workflow ${workflowId}: ${error.message}`);
    throw new Error(`Failed to update workflow stage ${stageId} in workflow ${workflowId}: ${error.message}`);
  }
};

export default updateWorkflowStage;
