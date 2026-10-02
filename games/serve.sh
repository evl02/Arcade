#!/usr/bin/env bash
# Preview the site locally. Relative paths mean this behaves exactly like
# GitHub Pages does, just on a different origin.
set -euo pipefail
cd "$(dirname "$0")"
echo "Arcade on http://localhost:8000/"
python3 -m http.server 8000
