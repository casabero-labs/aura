"""
AURA — Script de limpieza controlado v2 (fixture Incidentes Policiales).
Corrige patrones detectados por el motor determinista de AURA sin
destruir evidencia y sin introducir nulos críticos penalizados por runAudit.

Estrategia de remediación trazable:
- No borrar evidencia original (conservar crimeid_original).
- No dejar CrimeId vacío o nulo (usa placeholder no-tóxico).
- Usar placeholder semántico: "CORRUPTED_ID_REQUIRES_SOURCE_REVIEW".
- Marcar filas afectadas con crimeid_corrupted=True.
- No inventar IDs numéricos ficticios.
- Normalizar City y limpiar espacios.
"""

import pandas as pd

CORRUPTED_ID_PLACEHOLDER = "CORRUPTED_ID_REQUIRES_SOURCE_REVIEW"

DISPOSITION_VOCABULARY = {
    "handled advised": "Handled/Advised",
    "not recorded": "Not Recorded",
    "arrest citation": "Arrest/Citation",
    "gone unable to locate": "Gone/Unable to Locate",
}


def _normalize(value):
    if pd.isna(value) or not isinstance(value, str):
        return ""
    return (
        value.strip()
        .lower()
        .replace("/", " ")
        .replace("  ", " ")
    )


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Limpia el dataset aplicando correcciones trazables:
    - Marca filas donde CrimeId está contaminado con vocabulario de Disposition.
    - Sustituye CrimeId contaminado por placeholder no-nulo no-tóxico.
    - Retiene el CrimeId original como evidencia en columnas auxiliares.
    - Normaliza casing de City.
    - Recorta espacios externos en columnas string.
    """
    df = df.copy()

    df["crimeid_corrupted"] = False
    df["crimeid_original"] = df["CrimeId"].astype(str)
    df["crimeid_correction_note"] = ""

    for idx in df.index:
        crimeid_raw = str(df.at[idx, "CrimeId"])
        crimeid_norm = _normalize(crimeid_raw)

        if crimeid_norm in DISPOSITION_VOCABULARY:
            df.at[idx, "crimeid_corrupted"] = True
            df.at[idx, "crimeid_correction_note"] = (
                f"CrimeId contenía valor de Disposition: "
                f"'{DISPOSITION_VOCABULARY[crimeid_norm]}'. "
                f"Placeholder usado: '{CORRUPTED_ID_PLACEHOLDER}'. "
                f"Original conservado en crimeid_original."
            )
            df.at[idx, "CrimeId"] = CORRUPTED_ID_PLACEHOLDER

    if "City" in df.columns:
        df["City"] = df["City"].astype(str).str.strip().str.lower()

    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].apply(
                lambda x: x.strip() if isinstance(x, str) else x
            )

    return df
