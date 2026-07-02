# AURA Generated Script — Phase 8 L3 Pilot Run
# Dataset: controlled_customers_phase8.csv (SYNTHETIC — NO PII)
# Generated for controlled synthetic dataset. Review required. Not executed inside AURA.
# Python is executed externally (Colab). AURA does NOT execute Python.
# This dataset was NOT modified. A controlled fixture copy is used.

import pandas as pd
import numpy as np

# Script base generado por AURA desde hallazgos deterministas.
# Ejecutar sobre una copia del DataFrame original: df_clean = df.copy()
df_clean = df.copy()

# regla=Espacios Fantasma (Trim) issue=hygiene-ghost-full_name :: Recortar espacios externos y compactar espacios internos en full_name.
df_clean["full_name"] = df_clean["full_name"].astype('string').str.strip().str.replace(r'\s+', ' ', regex=True)

# regla=Placeholders Tóxicos issue=hygiene-toxic-full_name :: Convertir placeholders toxicos de full_name a null.
df_clean["full_name"] = df_clean["full_name"].replace(['', 'n/a', 'N/A', 'na', 'NA', 'null', 'NULL', 'none', 'None', '?', '-', '--'], np.nan)

# regla=Cola Larga Categórica issue=semantic-long-tail-full_name :: Revisar manualmente full_name: La columna tiene alta dispersión de categorías y baja concentración en los valores principales. Puede necesitar agrupación o macro-categorías antes del análisis.
# Requiere criterio humano antes de transformar esta columna.

# regla=Espacios Múltiples issue=hygiene-space-full_name :: Recortar espacios externos y compactar espacios internos en full_name.
df_clean["full_name"] = df_clean["full_name"].astype('string').str.strip().str.replace(r'\s+', ' ', regex=True)

# regla=Placeholders Tóxicos issue=hygiene-toxic-email :: Convertir placeholders toxicos de email a null.
df_clean["email"] = df_clean["email"].replace(['', 'n/a', 'N/A', 'na', 'NA', 'null', 'NULL', 'none', 'None', '?', '-', '--'], np.nan)

# regla=Espacios Fantasma (Trim) issue=hygiene-ghost-phone :: Recortar espacios externos y compactar espacios internos en phone.
df_clean["phone"] = df_clean["phone"].astype('string').str.strip().str.replace(r'\s+', ' ', regex=True)

# regla=Placeholders Tóxicos issue=hygiene-toxic-phone :: Convertir placeholders toxicos de phone a null.
df_clean["phone"] = df_clean["phone"].replace(['', 'n/a', 'N/A', 'na', 'NA', 'null', 'NULL', 'none', 'None', '?', '-', '--'], np.nan)

# regla=Espacios Múltiples issue=hygiene-space-phone :: Recortar espacios externos y compactar espacios internos en phone.
df_clean["phone"] = df_clean["phone"].astype('string').str.strip().str.replace(r'\s+', ' ', regex=True)

# regla=Espacios Fantasma (Trim) issue=hygiene-ghost-city :: Recortar espacios externos y compactar espacios internos en city.
df_clean["city"] = df_clean["city"].astype('string').str.strip().str.replace(r'\s+', ' ', regex=True)

# regla=Caos de Capitalización issue=hygiene-case-city :: Normalizar casing de city para reducir categorias duplicadas.
df_clean["city"] = df_clean["city"].astype('string').str.strip().str.title()

# regla=Cola Larga Categórica issue=semantic-long-tail-city :: Revisar manualmente city: La columna tiene alta dispersión de categorías y baja concentración en los valores principales. Puede necesitar agrupación o macro-categorías antes del análisis.
# Requiere criterio humano antes de transformar esta columna.

# regla=Espacios Múltiples issue=hygiene-space-city :: Recortar espacios externos y compactar espacios internos en city.
df_clean["city"] = df_clean["city"].astype('string').str.strip().str.replace(r'\s+', ' ', regex=True)

# regla=Caos de Capitalización issue=hygiene-case-plan_type :: Normalizar casing de plan_type para reducir categorias duplicadas.
df_clean["plan_type"] = df_clean["plan_type"].astype('string').str.strip().str.title()

# regla=Negativos Imposibles issue=logic-neg-credits_used :: Revisar manualmente credits_used: Valores negativos en campo lógico (Edad, Precio).
# Requiere criterio humano antes de transformar esta columna.

# regla=Outliers Extremos (IQR 3×) issue=logic-outlier-credits_used :: Revisar manualmente credits_used: Valores desviados > 3× del rango intercuartílico.
# Requiere criterio humano antes de transformar esta columna.

# regla=Outliers Extremos (IQR 3×) issue=logic-outlier-total_credits :: Revisar manualmente total_credits: Valores desviados > 3× del rango intercuartílico.
# Requiere criterio humano antes de transformar esta columna.

# regla=Outliers Leves (Tukey 1.5×) issue=logic-outlier-tukey-total_credits :: Revisar manualmente total_credits: Valores desviados entre 1.5× y 3× del rango intercuartílico (mild Tukey outliers).
# Requiere criterio humano antes de transformar esta columna.

# Resultado: df_clean contiene las transformaciones seguras propuestas por AURA.