import { PLAN_TYPES } from "./types.js";

function assertKnowledgeTemplates(knowledge) {
  const templates = knowledge?.output_templates;
  if (!templates) {
    throw new Error("Knowledge file is missing output_templates.");
  }

  return templates;
}

export function selectSchemaByPlanType(planType, knowledge) {
  const templates = assertKnowledgeTemplates(knowledge);

  if (planType === PLAN_TYPES.TRADITIONAL) {
    return templates.traditional_plan_schema;
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    return templates.active_learning_plan_schema;
  }

  throw new Error(`Unsupported plan_type: ${planType}`);
}

export function selectStrategyBankByPlanType(planType, knowledge) {
  if (planType === PLAN_TYPES.TRADITIONAL) {
    return knowledge?.traditional_strategies ?? [];
  }

  if (planType === PLAN_TYPES.ACTIVE_LEARNING) {
    return knowledge?.active_learning_strategies ?? [];
  }

  throw new Error(`Unsupported plan_type: ${planType}`);
}

export function selectPlanRuntimeResources(planType, knowledge) {
  return {
    targetSchema: selectSchemaByPlanType(planType, knowledge),
    strategyBank: selectStrategyBankByPlanType(planType, knowledge),
  };
}

export function getStrategyNames(strategyBank = []) {
  return strategyBank
    .map((strategy) => strategy?.name)
    .filter((value) => typeof value === "string" && value.trim().length > 0);
}
