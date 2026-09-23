export const INGESTION_PATTERNS = {
  CREATE_SUBGROUP: 'ingestion.create-subgroup',
  LIST_SUBGROUPS: 'ingestion.list-subgroups',
  LIST_SUBGROUPS_PAGE: 'ingestion.list-subgroups-page',
  UPDATE_SUBGROUP: 'ingestion.update-subgroup',
  DELETE_SUBGROUP: 'ingestion.delete-subgroup',
  CREATE_COLOUR_BATCH: 'ingestion.create-colour-batch',
  LIST_COLOUR_BATCHES: 'ingestion.list-colour-batches',
  UPDATE_COLOUR_BATCH: 'ingestion.update-colour-batch',
  DELETE_COLOUR_BATCH: 'ingestion.delete-colour-batch',
} as const;

export const SPC_ENGINE_PATTERNS = {
  COMPUTE_SUMMARY: 'spc-engine.compute-summary',
  COMPUTE_P_CHART: 'spc-engine.compute-p-chart',
} as const;

export const ALERTING_PATTERNS = {
  EVALUATE_STATUS: 'alerting.evaluate-status',
} as const;
