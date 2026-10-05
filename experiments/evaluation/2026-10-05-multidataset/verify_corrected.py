#!/usr/bin/env python3
"""Uso: verify_corrected.py <original> <corrected> [sep] [encoding]  — diff por columna leyendo todo como str."""
import sys, pandas as pd
o, c = sys.argv[1], sys.argv[2]; sep = sys.argv[3] if len(sys.argv) > 3 else ','; enc = sys.argv[4] if len(sys.argv) > 4 else 'utf-8-sig'
ob, cb = open(o, 'rb').read(), open(c, 'rb').read()
print('BOM', ob[:3] == b'\xef\xbb\xbf', cb[:3] == b'\xef\xbb\xbf', '| CRLF', b'\r\n' in ob, b'\r\n' in cb)
a = pd.read_csv(o, sep=sep, encoding=enc, dtype=str, keep_default_na=False)
b = pd.read_csv(c, sep=sep, encoding=enc, dtype=str, keep_default_na=False)
print('shape', a.shape, '->', b.shape, '| columnas iguales', list(a.columns) == list(b.columns))
if len(a) == len(b):
    for col in a.columns: print(' ', col, 'idéntica' if (a[col] == b[col]).all() else f'cambia en {(a[col] != b[col]).sum()} filas')
else:
    print('  filas distintas; columnas sobre índice común no comparadas')
