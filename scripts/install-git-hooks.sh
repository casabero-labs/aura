#!/bin/sh
# Instala el pre-push versionado de AURA sin tocar otros hooks locales.
set -e
root="$(git rev-parse --show-toplevel)"
ln -sf "../../.githooks/pre-push" "$root/.git/hooks/pre-push"
echo "pre-push instalado → .githooks/pre-push"
