# AURA diagnosis input mode: recommended
# AURA input receipt: 9fd45fe7ad8acfe542f2fa6dc341345b85b3182556faa6e3b5567870a2988928
# AURA prompt hash: d456c25581cddc11011a13b3ea46a42092ae6b750c95141bd306d3f8e98dfec0
# AURA input hash: d6c0c2fc53ede143ddbb15d3f6366801d8b593b80000e4f085af2d4e5afd5e5e
# AURA evidence envelope: env:84f35ac4e828fafaaea2af5469a405700881c1082ed31d221164bfcf54d480b0

import pandas as pd
import numpy as np

_c = {
    "col:66c132b9f764eca1": "id",
    "col:c48ed5501a3f61e9": "nombre",
    "col:14a06a875d2805a1": "edad",
    "col:3ccf050c2a6ae5c6": "salario",
    "col:534000c8bf517b29": "email",
    "col:715d2723c97715b7": "departamento",
    "col:623e34a359a89dd3": "fecha_ingreso",
    "col:f9b45ca6934a8296": "estado",
    "col:e7b2c5a4df357066": "ip_acceso"
}

def clean_dataset(df):
    df_clean = df.copy()
    df_clean = df_clean.drop_duplicates(keep="first").copy()
    df_clean[_c["col:14a06a875d2805a1"]] = df_clean[_c["col:14a06a875d2805a1"]].replace(["", "n/a", "N/A", "na", "NA", "null", "NULL", "none", "None", "?", "-", "--", "...", "NaN", "NAN", "nan", "N/a"], np.nan)
    df_clean[_c["col:534000c8bf517b29"]] = df_clean[_c["col:534000c8bf517b29"]].replace(["", "n/a", "N/A", "na", "NA", "null", "NULL", "none", "None", "?", "-", "--", "...", "NaN", "NAN", "nan", "N/a"], np.nan)
    df_clean[_c["col:f9b45ca6934a8296"]] = df_clean[_c["col:f9b45ca6934a8296"]].replace(["", "n/a", "N/A", "na", "NA", "null", "NULL", "none", "None", "?", "-", "--", "...", "NaN", "NAN", "nan", "N/a"], np.nan)
    return df_clean
