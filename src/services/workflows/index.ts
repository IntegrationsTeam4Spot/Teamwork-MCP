import getWorkflows, { GetWorkflowsParams } from "./getWorkflows.js";
import getWorkflowStagesByWorkflowId from "./getWorkflowStagesByWorkflowId.js";
import getWorkflowStageById from "./getWorkflowStageById.js";
import updateWorkflowStage from "./updateWorkflowStage.js";

export {
  getWorkflows,
  getWorkflowStagesByWorkflowId,
  getWorkflowStageById,
  updateWorkflowStage,
  GetWorkflowsParams
};

export default {
  getWorkflows,
  getWorkflowStagesByWorkflowId,
  getWorkflowStageById,
  updateWorkflowStage
};
