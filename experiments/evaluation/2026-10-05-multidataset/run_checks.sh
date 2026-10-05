#!/bin/bash
# uso: run_checks.sh <ID> <dataset> [recorridos...]   (A0 A1 B)
ID=$1; DS=$2; shift 2
for r in "$@"; do
  case $r in A0) fl="";; A1) fl="--nano";; B) fl="--nano --corrected";; esac
  [ -f runs/$ID/$r/evidence.zip ] || continue
  python3 check_zip.py runs/$ID/$r/evidence.zip $DS $fl | python3 -c "import json,sys; d=json.load(sys.stdin); print('$ID $r',d['passed'],'/',d['total']); [print('  ✖',c['name'],c['detail'][:110]) for c in d['checks'] if not c['ok']]"
done
