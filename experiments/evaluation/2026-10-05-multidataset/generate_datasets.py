#!/usr/bin/env python3
"""Genera D7–D11 de la evaluación multidataset (semilla fija, sin dependencias)."""
import json, random
from pathlib import Path

OUT = Path(__file__).parent / "datasets"
OUT.mkdir(exist_ok=True)
rnd = random.Random(20261005)


def write(name, data: bytes, expected: dict):
    (OUT / name).write_bytes(data)
    (OUT / (name.rsplit(".", 1)[0] + ".expected.json")).write_text(
        json.dumps(expected, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# D7: windows-1252, ';', CRLF
ciudades = ["Bogotá", "Medellín", "São Paulo", "Ñandú", "Cali", "Quito"]
filas = [["id", "ciudad", "importe", "codigo", "nota"]]
for i in range(1, 31):
    importe = {5: "120.00", 6: "120", 7: "-0", 8: ""}.get(i, f"{rnd.randint(10, 900)},{rnd.randint(0, 99):02d}")
    codigo = "001" if i == 1 else f"{i:03d}"
    filas.append([str(i), ciudades[i % len(ciudades)], importe, codigo, "" if i % 7 == 0 else "ok"])
txt = "\r\n".join(";".join(r) for r in filas) + "\r\n"
write("latin1_semicolon.csv", txt.encode("cp1252"), {
    "encoding": "windows-1252", "delimiter": ";", "lineEnding": "CRLF", "rows": 30, "columns": 5,
    "preserveLiterally": ["001", "120.00", "120", "-0", "Bogotá", "Ñandú", "São Paulo"]})

# D8: UTF-8 BOM, comillas con comas/saltos, emojis, fórmulas
f = [["id", "texto", "formula", "emoji"]]
trig = ["=SUM(A1)", "+cmd", "-2+3", "@user", "normal"]
for i in range(1, 31):
    t = f'línea {i}, con coma' if i % 3 else f'dos\nlíneas {i}'
    f.append([str(i), t, trig[i % 5], "🙂" if i % 4 == 0 else "x"])
import csv, io
buf = io.StringIO(newline="")
csv.writer(buf, lineterminator="\n").writerows(f)
write("utf8_bom_quoted.csv", b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8"), {
    "encoding": "utf-8", "bom": True, "delimiter": ",", "rows": 30, "columns": 4,
    "preserveLiterally": ["=SUM(A1)", "+cmd", "-2+3", "@user", "🙂"],
    "csvInjection": "issues.csv debe prefijar ' en celdas que empiezan con = + - @"})

# D9: filas irregulares y comilla sin cerrar
lines = ["a,b,c"] + [f"{i},{i*2},{i*3}" for i in range(4)] + ["9,9", "8,8,8,8", '7,"sin cerrar,7', "6,6,6"]
write("broken_ragged.csv", ("\n".join(lines) + "\n").encode(), {
    "expectedError": "carga falla claro en español indicando fila o tipo de problema; sin Perfil ni puntuación"})

# D10
write("empty.csv", b"", {"expectedError": "archivo vacío, mensaje claro"})
write("header_only.csv", b"id,nombre,valor\n", {"expectedError": "solo cabecera, sin filas; mensaje claro"})

# D11: 40 columnas, ~200 filas
cols = ["id_cod"] + [f"c{i:02d}" for i in range(1, 40)]
rows = [cols]
for r in range(200):
    row = [f"{r:05d}"]
    for j in range(1, 40):
        if j == 1: row.append("CONST")
        elif j % 3 == 0: row.append(str(rnd.randint(0, 1000)))
        elif j % 3 == 1: row.append(f"{rnd.random()*100:.2f}")
        else: row.append(rnd.choice(["a", "b", "c", "", "d"]))
    rows.append(row)
write("wide_40cols.csv", ("\n".join(",".join(r) for r in rows) + "\n").encode(), {
    "encoding": "utf-8", "rows": 200, "columns": 40, "preserveLiterally": ["00000", "00001"],
    "constantColumn": "c01", "envelopeColumnLimit": 16})
print("ok", sorted(p.name for p in OUT.iterdir()))
