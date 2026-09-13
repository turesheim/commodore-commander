#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"
kickass_jar="${KICKASS_JAR:-$repo_dir/resources/KickAss.jar}"
sidscore_jar="${SIDSCORE_JAR:-$repo_dir/resources/sidscore-cli-0.7.2.jar}"
output_jar="${OUTPUT_JAR:-$repo_dir/resources/sidscore-kickass-plugin.jar}"

for dependency in "$kickass_jar" "$sidscore_jar"; do
  if [[ ! -f "$dependency" ]]; then
    echo "Required jar not found: $dependency" >&2
    exit 1
  fi
done

build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
mkdir -p "$build_dir/classes"

sources=()
while IFS= read -r -d '' source; do
  sources+=("$source")
done < <(find "$script_dir/src/main/java" -name '*.java' -type f -print0)
if [[ ${#sources[@]} -eq 0 ]]; then
  echo "No plugin Java sources found" >&2
  exit 1
fi

javac --release 21 -cp "$kickass_jar:$sidscore_jar" -d "$build_dir/classes" "${sources[@]}"
mkdir -p "$(dirname "$output_jar")"
jar --create --file "$output_jar" -C "$build_dir/classes" .
echo "Built $output_jar"
