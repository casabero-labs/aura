#!/usr/bin/env python3
"""Checklist de coherencia de un ZIP de evidencia AURA (sección 5 del plan).
Uso: check_zip.py <evidence.zip> <dataset.csv> [--nano] [--corrected]
Imprime JSON {passed,total,checks:[{name,ok,detail}]}."""
import sys, json, zipfile, hashlib, csv, io, re

def sha(b): return hashlib.sha256(b).hexdigest()

def main():
    zpath, ds = sys.argv[1], sys.argv[2]
    nano, corrected = "--nano" in sys.argv, "--corrected" in sys.argv
    z = zipfile.ZipFile(zpath); names = set(z.namelist()); checks = []
    def chk(name, ok, detail=""): checks.append({"name": name, "ok": bool(ok), "detail": str(detail)[:300]})
    raw = open(ds, "rb").read(); dsha = sha(raw)
    m = json.loads(z.read("manifest.json"))
    bad = [f["path"] for f in m["files"] if f["path"] not in names or sha(z.read(f["path"])) != f["sha256"]]
    chk("manifest sha256 por archivo", not bad, bad)
    chk("manifest.datasetSha256 == SHA del CSV", m.get("datasetSha256") == dsha, m.get("datasetSha256"))
    chk("privacy.rawDatasetIncluded false", m["privacy"]["rawDatasetIncluded"] is False)
    base = ds.rsplit("/", 1)[-1]
    chk("CSV original no está en el ZIP", not any(n.endswith(base) and n != "corrected.csv" for n in names) and not any(z.read(n) == raw for n in names))
    rcpt = "diagnosis/execution-receipt.json" if "diagnosis/execution-receipt.json" in names else None
    if nano:
        chk("existe execution-receipt", rcpt, rcpt)
        if rcpt:
            r = json.loads(z.read(rcpt)); fe = r.get("fragmentedExecution") or {}
            frs = {n: json.loads(z.read(n)) for n in names if re.search(r"diagnosis/fragments/.*\.json$", n)}
            nfind = len(frs)
            chk("requestCount >= nº fragmentos", fe.get("requestCount", 0) >= nfind > 0, (fe.get("requestCount"), nfind))
            hs = {f.get("promptHash") for f in fe.get("fragments", [])}
            chk("promptHash de recibo == fragmentos", all(f.get("promptHash") in hs for f in frs.values()))
            ok = all(f.get("rawResponseHash") == sha(f["rawResponse"].encode()) for f in frs.values() if "rawResponse" in f and "rawResponseHash" in f)
            chk("rawResponseHash == sha256(rawResponse)", ok)
            blob = json.dumps(r)
            chk("recibo Chrome sin temperatura/contexto (null)", r.get("inference", r).get("temperature", None) in (None,) if isinstance(r.get("inference", r), dict) else True, "")
    if "findings/issues.csv" in names:
        rows = list(csv.reader(io.StringIO(z.read("findings/issues.csv").decode("utf-8-sig"))))
        inj = [c for r in rows[1:] for c in r if c and c[0] in "=+-@"]
        chk("issues.csv sin celdas =+-@ sin prefijo '", not inj, inj[:3])
    desc = " ".join(f["description"] for f in m["files"])
    readme = z.read("README.md").decode()
    promised = [w for w in ("plan", "contrato", "verificaci", "script") if w in (readme + desc).lower()]
    present = [n for n in names if re.search(r"remediation/(plan|contract|verification|script)", n)]
    chk("ZIP no promete archivos ausentes (EXP-1)", not promised or present, {"prometido": promised, "presentes": present})
    if corrected:
        chk("corrected.csv presente", "corrected.csv" in names or any(n.endswith("corrected.csv") for n in names))
        chk("receipt.json válido", any(n.endswith("receipt.json") for n in names))
    out = {"passed": sum(c["ok"] for c in checks), "total": len(checks), "checks": checks}
    print(json.dumps(out, ensure_ascii=False, indent=1))

main()
