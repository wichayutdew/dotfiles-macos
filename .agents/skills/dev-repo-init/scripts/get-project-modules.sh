#!/usr/bin/env bash
# Script to deterministically identify modules in Agoda projects
# Supports: Gradle/Kotlin, SBT/Scala, Python, .NET/C#, and nested React projects
# Usage: ./get-project-modules.sh <project-path>
# Output: JSON array with {name, language, path} for each module

set -euo pipefail

PROJECT_PATH="${1:-.}"

if [[ ! -d "$PROJECT_PATH" ]]; then
    echo "{\"error\":\"Project path does not exist\",\"project_path\":\"$PROJECT_PATH\"}"
    exit 0
fi

detect_language() {
    local module_path="$1"
    local languages=()

    if fd -e scala . "$module_path" -q 2>/dev/null; then
        languages+=("Scala")
    fi
    if fd -e kt . "$module_path" -q 2>/dev/null; then
        languages+=("Kotlin")
    fi
    if fd -e py . "$module_path" -q 2>/dev/null; then
        languages+=("Python")
    fi
    if fd -e cs . "$module_path" -q 2>/dev/null; then
        languages+=("C#")
    fi
    if fd -e tsx -e ts . "$module_path" -q 2>/dev/null; then
        languages+=("TypeScript")
    fi
    if fd -e jsx -e js . "$module_path" -q 2>/dev/null; then
        if [[ ${#languages[@]} -eq 0 ]] || [[ ! " ${languages[@]} " =~ " TypeScript " ]]; then
            languages+=("JavaScript")
        fi
    fi
    if fd -e java . "$module_path" -q 2>/dev/null; then
        languages+=("Java")
    fi

    if [[ ${#languages[@]} -gt 0 ]]; then
        local IFS=","
        echo "${languages[*]}"
    else
        echo ""
    fi
}

find_nested_frontend_modules() {
    local parent_path="$1"
    local parent_module="$2"
    local modules=()

    while IFS= read -r pkg_file; do
        local pkg_dir=$(dirname "$pkg_file")
        local module_name=$(basename "$pkg_dir")
        local relative_path="${pkg_dir#$PROJECT_PATH/}"
        local languages=$(detect_language "$pkg_dir")

        if [[ "$pkg_dir" != "$parent_path" && -n "$languages" ]]; then
            modules+=("{\"name\":\"$module_name\",\"language\":\"$languages\",\"path\":\"$relative_path\"}")
        fi
    done < <(fd -t f '^package\.json$' "$parent_path" --exclude node_modules --max-depth 3 2>/dev/null || true)

    if [[ ${#modules[@]} -gt 0 ]]; then
        printf '%s\n' "${modules[@]}"
    fi
}

declare -a modules=()

if [[ -f "$PROJECT_PATH/settings.gradle.kts" ]]; then
    while IFS= read -r module_name; do
        module_path="${module_name//://}"
        full_path="$PROJECT_PATH/$module_path"

        if [[ -d "$full_path" ]]; then
            languages=$(detect_language "$full_path")
            modules+=("{\"name\":\"$module_name\",\"language\":\"$languages\",\"path\":\"$module_path\"}")

            while IFS= read -r nested; do
                [[ -n "$nested" ]] && modules+=("$nested")
            done < <(find_nested_frontend_modules "$full_path" "$module_name")
        fi
    done < <(grep -E '^\s*include\(' "$PROJECT_PATH/settings.gradle.kts" | sed -E 's/.*include\("([^"]+)"\).*/\1/' | sed 's/^://')

elif [[ -f "$PROJECT_PATH/build.sbt" ]]; then
    while IFS= read -r module_name; do
        if grep -A5 "lazy val \`\{0,1\}$module_name\`\{0,1\} = project" "$PROJECT_PATH/build.sbt" | grep -q "\.aggregate("; then
            continue
        fi

        module_path=$(grep -A2 "lazy val \`\{0,1\}$module_name\`\{0,1\} = project" "$PROJECT_PATH/build.sbt" | grep -oE '\.in\(file\("([^"]+)"\)\)' | sed -E 's/.*file\("([^"]+)"\).*/\1/' || echo "$module_name")
        module_path="${module_path#./}"
        full_path="$PROJECT_PATH/$module_path"

        if [[ -d "$full_path" ]]; then
            languages=$(detect_language "$full_path")
            modules+=("{\"name\":\"$module_name\",\"language\":\"$languages\",\"path\":\"$module_path\"}")

            while IFS= read -r nested; do
                [[ -n "$nested" ]] && modules+=("$nested")
            done < <(find_nested_frontend_modules "$full_path" "$module_name")
        fi
    done < <(grep -E '^\s*lazy val .* = project' "$PROJECT_PATH/build.sbt" | sed -E 's/^\s*lazy val `?([^`]+)`? =.*/\1/')

elif [[ -f "$PROJECT_PATH/pyproject.toml" ]]; then
    while IFS= read -r dir_path; do
        module_name=$(basename "$dir_path")
        relative_path="${dir_path#$PROJECT_PATH/}"
        relative_path="${relative_path%/}"
        languages=$(detect_language "$dir_path")

        if [[ -n "$languages" ]]; then
            modules+=("{\"name\":\"$module_name\",\"language\":\"$languages\",\"path\":\"$relative_path\"}")

            while IFS= read -r nested; do
                [[ -n "$nested" ]] && modules+=("$nested")
            done < <(find_nested_frontend_modules "$dir_path" "$module_name")
        fi
    done < <(fd -t d --max-depth 1 --exclude '.*' --exclude '__pycache__' --exclude '*.egg-info' --exclude 'node_modules' . "$PROJECT_PATH")

elif fd -e csproj . "$PROJECT_PATH" --max-depth 4 &>/dev/null && [[ $(fd -e csproj . "$PROJECT_PATH" --max-depth 4 2>/dev/null | wc -l) -gt 0 ]]; then
    while IFS= read -r csproj_file; do
        module_dir=$(dirname "$csproj_file")
        module_name=$(basename "$module_dir")
        relative_path="${module_dir#$PROJECT_PATH/}"
        languages=$(detect_language "$module_dir")

        modules+=("{\"name\":\"$module_name\",\"language\":\"$languages\",\"path\":\"$relative_path\"}")

        while IFS= read -r nested; do
            [[ -n "$nested" ]] && modules+=("$nested")
        done < <(find_nested_frontend_modules "$module_dir" "$module_name")
    done < <(fd -e csproj . "$PROJECT_PATH" --max-depth 4 2>/dev/null)

else
    echo "{\"error\":\"Unknown project type or no build configuration found\",\"project_path\":\"$PROJECT_PATH\"}"
    exit 0
fi

echo "["
for i in "${!modules[@]}"; do
    echo -n "  ${modules[$i]}"
    if [[ $i -lt $((${#modules[@]} - 1)) ]]; then
        echo ","
    else
        echo ""
    fi
done
echo "]"
