#!/usr/bin/env bash
set -euo pipefail
pilot_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export BICEP_BIN="${BICEP_BIN:-bicep}"
export PYTHONDONTWRITEBYTECODE=1
python3 -m unittest discover -s "$pilot_dir/tests" -p 'test_*.py' -v
