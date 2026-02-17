#!/usr/bin/env bash
set -euo pipefail

# Restrict scanning to tracked files so local build/dependency artifacts do not create false positives.
PATTERN='isValidBase64ImageDataUrl|input_image|data:image/|image_url\)|Buffer\.from\(b64'

matches="$(git ls-files -z | xargs -0 rg -n --color=never -e "$PATTERN" || true)"

if [[ -n "$matches" ]]; then
  printf '%s\n' "$matches"
  echo
  echo "Found one or more forbidden image/base64 patterns."
  exit 1
fi

echo "No matches found in tracked files."
