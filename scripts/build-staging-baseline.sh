#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$script_dir/.." && pwd)"
output_dir="$repo_dir/sql/generated"
output_file="$output_dir/staging_baseline.sql"
exercise_repair_file="$output_dir/staging_exercise_library_repair.sql"

source_files=(
  "sql/supabase_schema.sql"
  "sql/profile_fields_v1.sql"
  "sql/profile_gender_v1.sql"
  "sql/profile_gender_v2_remove_nonbinary.sql"
  "sql/rls_policies_v1.sql"
  "sql/signup_group_selection_v1.sql"
  "sql/username_login_v1.sql"
  "sql/h2k_band_color_v1.sql"
  "sql/h2k_band_color_v2_levels.sql"
  "sql/exercise_library_v1.sql"
  "sql/profile_picture_storage_v1.sql"
  "sql/seed_rip_city.sql"
  "sql/exercise_library_seed_rip_city_v1.sql"
)

mkdir -p "$output_dir"

{
  printf '%s\n' '-- GENERATED FILE: do not edit directly.'
  printf '%s\n' '-- Build with: bash scripts/build-staging-baseline.sh'
  printf '%s\n' '-- Fresh empty staging projects only. Never run blindly on production.'
  printf '\n%s\n\n' 'begin;'

  for source_file in "${source_files[@]}"; do
    printf '%s\n' '-- ====================================================='
    printf '%s\n' "-- SOURCE: $source_file"
    printf '%s\n\n' '-- ====================================================='
    sed -n '1,$p' "$repo_dir/$source_file"
    printf '\n\n'
  done

  printf '%s\n' 'commit;'
} > "$output_file"

printf 'Built %s\n' "$output_file"

{
  printf '%s\n' '-- GENERATED STAGING REPAIR: do not run on production.'
  printf '%s\n' '-- Normalizes exercise-library grants and policy names atomically.'
  printf '\n%s\n\n' 'begin;'
  sed -n '1,$p' "$repo_dir/sql/exercise_library_v1.sql"
  printf '\n%s\n' 'commit;'
} > "$exercise_repair_file"

printf 'Built %s\n' "$exercise_repair_file"
