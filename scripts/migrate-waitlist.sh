#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
location="${2:-}"
if [[ "$environment" != preview && "$environment" != production ]] ||
   [[ "$location" != --local && "$location" != --remote ]]; then
  printf 'Usage: pnpm run db:migrate <preview|production> <--local|--remote> [--persist-to directory]\n' >&2
  exit 2
fi
shift 2
if (( $# != 0 )); then
  if (( $# != 2 )) || [[ "$location" != --local || "$1" != --persist-to ]]; then
    printf 'Only local migrations accept --persist-to followed by a directory.\n' >&2
    exit 2
  fi
fi

wrangler=(pnpm dlx --allow-build=esbuild,workerd wrangler@4.160.1)
args=(WAITLIST_DB --config wrangler.d1.toml --env "$environment" "$location" "$@")
"${wrangler[@]}" d1 execute "${args[@]}" --file scripts/adopt-waitlist-migrations.sql
"${wrangler[@]}" d1 migrations apply "${args[@]}"
