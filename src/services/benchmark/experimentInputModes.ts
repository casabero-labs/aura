/**
 * Compatibility entrypoint for OE4 input snapshots.
 * The implementation lives in contracts/llm so product and Laboratory share
 * exactly one builder.
 */
export {
  buildDiagnosisInputPackageV2 as buildExperimentInputPackage,
  DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE as OE4_INCLUDED_SECTIONS_BY_MODE,
} from '../../contracts/llm/diagnosisInputPackageV2';
