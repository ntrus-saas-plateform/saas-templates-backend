import {
  DISCOVERY_TEMPLATES,
  isBantComplete,
  LOST_REASONS_TAXONOMY,
  SALES_PIPELINE_STAGES,
  scoreLead,
  type BantFields,
  type LeadScoreInput,
} from '../../domain/sales/sales-engine-beachhead.js';

export class GetSalesEngineBeachheadUseCase {
  execute() {
    return {
      data: {
        pipeline: SALES_PIPELINE_STAGES,
        lostReasons: LOST_REASONS_TAXONOMY,
        discoveryTemplates: DISCOVERY_TEMPLATES,
      },
    };
  }
}

export class ScoreLeadUseCase {
  execute(input: LeadScoreInput) {
    return { data: scoreLead(input) };
  }
}

export class EvaluateBantUseCase {
  execute(input: BantFields) {
    return {
      data: {
        complete: isBantComplete(input),
        fields: input,
      },
    };
  }
}
