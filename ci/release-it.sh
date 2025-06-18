#!/usr/bin/env bash

set -e

pkg=$1
name=$(basename "$pkg")

version=$(jq -r '.version' "$pkg/package.json")
tag="${name}-${version}"

echo "Processing $pkg ($tag)"

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Tag $tag already exists — skipping tagging & GitHub release."
else
  echo "Tag does not exist — running release-it for $tag..."
  (
    cd "$pkg"
    npx release-it --no-increment --ci || echo "Release-it failed for $tag"
  )
fi

echo "Finished processing $tag"
