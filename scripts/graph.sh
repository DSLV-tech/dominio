#!/usr/bin/env bash
# Aggiorna il grafo Graphify della codebase (graphify-out/).
# Solo analisi del codice (tree-sitter): niente API key, niente costi.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v graphify >/dev/null 2>&1; then
  echo "Graphify non trovato: lo installo (pacchetto pip 'graphifyy')…"
  if command -v pipx >/dev/null 2>&1; then
    pipx install graphifyy
  else
    python3 -m pip install --user graphifyy
    echo "Se 'graphify' non viene trovato, aggiungi al PATH: $(python3 -m site --user-base)/bin"
  fi
fi

graphify update . --force
echo "Fatto. Report: graphify-out/GRAPH_REPORT.md · grafo interattivo: graphify-out/graph.html"
