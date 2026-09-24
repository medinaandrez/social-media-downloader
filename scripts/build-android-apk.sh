#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${APK_OUTPUT_DIR:-/Volumes/Data/Users/andres/Library/CloudStorage/OneDrive-UniversidadAPEC-Académico/APKs}"
apk_name="Social_Media_Downloader.apk"
build_apk="$repo_root/android/app/build/outputs/apk/release/app-release.apk"

bash "$repo_root/scripts/with-android-env.sh" \
  "$repo_root/android/gradlew" -p "$repo_root/android" assembleRelease

mkdir -p "$output_dir"
mv -f "$build_apk" "$output_dir/$apk_name"

echo "APK ready: $output_dir/$apk_name"
