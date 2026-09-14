export const INGESTION_PATTERNS = {
  CREATE_SUBGROUP: 'ingestion.create-subgroup',
  LIST_SUBGROUPS: 'ingestion.list-subgroups',
  DELETE_SUBGROUP: 'ingestion.delete-subgroup',
} as const;

export const SPC_ENGINE_PATTERNS = {
  COMPUTE_SUMMARY: 'spc-engine.compute-summary',
} as const;

export const ALERTING_PATTERNS = {
  EVALUATE_STATUS: 'alerting.evaluate-status',
} as const;
