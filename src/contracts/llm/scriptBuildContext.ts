/**
 * Script Build Context — Phase 4 Loop 1.
 *
 * Builds ScriptBuildContextV2 from RemediationContextV2 and ColumnRef[].
 * Does NOT modify RemediationContextV2.
 */

import type {
  RemediationContextV2,
  ScriptBuildContextV2,
  CorrespondenceEvidenceV2,
  ColumnRef,
} from './types';
import { buildColumnRegistryV2 } from './scriptColumnResolver';

function buildCorrespondenceEvidence(
  remediationContext: RemediationContextV2,
  sourceDatasetFingerprint: string,
  columnRegistry: { byColumnId: ReadonlyMap<string, ColumnRef> },
): CorrespondenceEvidenceV2 {
  const columnsFromContext = remediationContext.columns.length;
  const columnsInRegistry = columnRegistry.byColumnId.size;

  const fingerprintMatch = remediationContext.datasetFingerprint === sourceDatasetFingerprint;

  const contextColumnIds = new Set(remediationContext.columns.map(c => c.columnId));
  const registryColumnIds = new Set(columnRegistry.byColumnId.keys());

  const missingColumnIds: string[] = [];
  for (const cid of contextColumnIds) {
    if (!registryColumnIds.has(cid)) {
      missingColumnIds.push(cid);
    }
  }

  const mismatchedColumns: string[] = [];
  for (const col of remediationContext.columns) {
    const registryCol = columnRegistry.byColumnId.get(col.columnId);
    if (registryCol) {
      if (
        registryCol.name !== col.name ||
        registryCol.position !== col.position ||
        registryCol.duplicateOrdinal !== col.duplicateOrdinal ||
        registryCol.isAmbiguous !== col.isAmbiguous ||
        registryCol.isDuplicate !== col.isDuplicate
      ) {
        mismatchedColumns.push(col.columnId);
      }
    }
  }

  const columnsMatch =
    columnsFromContext === columnsInRegistry &&
    missingColumnIds.length === 0 &&
    mismatchedColumns.length === 0;

  const valid = fingerprintMatch && columnsMatch;

  return {
    fingerprintMatch,
    columnsMatch,
    missingColumnIds: Object.freeze(missingColumnIds),
    mismatchedColumns: Object.freeze(mismatchedColumns),
    columnsFromContext,
    columnsInRegistry,
    valid,
  };
}

export function buildScriptContext(
  remediationContext: RemediationContextV2,
  columnRefs: ColumnRef[],
  sourceDatasetFingerprint: string,
): ScriptBuildContextV2 {
  const columnRegistry = buildColumnRegistryV2(columnRefs);

  const correspondenceEvidence = buildCorrespondenceEvidence(
    remediationContext,
    sourceDatasetFingerprint,
    columnRegistry,
  );

  return {
    remediationContext,
    sourceDatasetFingerprint,
    columnRegistry,
    correspondenceEvidence,
  };
}
