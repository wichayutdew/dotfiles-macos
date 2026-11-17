#!/usr/bin/env bash
# Convert every WebM recording in a sign-off video directory to MP4.
# Usage: convert-videos.sh <video_dir>

set -euo pipefail

if [[ $# -ne 1 || ! -d "$1" ]]; then
  echo "Usage: $0 <video_dir>" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to convert video evidence to MP4" >&2
  exit 1
fi

video_dir="$1"
found=false

while IFS= read -r -d '' webm_file; do
  found=true
  mp4_file="${webm_file%.webm}.mp4"
  if [[ -s "$mp4_file" && "$mp4_file" -nt "$webm_file" ]]; then
    echo "Up to date: $mp4_file"
    continue
  fi

  temp_file="${webm_file%.webm}.converting.mp4"
  ffmpeg -loglevel error -y -i "$webm_file" \
    -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k \
    -movflags +faststart "$temp_file"
  if [[ ! -s "$temp_file" ]]; then
    echo "Conversion produced an empty file: $webm_file" >&2
    exit 1
  fi
  mv -f "$temp_file" "$mp4_file"
  echo "Converted: $mp4_file"
done < <(find "$video_dir" -maxdepth 1 -type f -name '*.webm' -print0)

if [[ "$found" == false ]]; then
  echo "No WebM recordings found in $video_dir" >&2
  exit 1
fi
