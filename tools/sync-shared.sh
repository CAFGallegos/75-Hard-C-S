#!/bin/sh
# The edge functions (api, notify) run the app's own rules and daily-line code so the app,
# the widget and the notifications all agree. Run this after editing js/rules.js,
# js/daily.js or js/daily-lines.js, then redeploy api and notify.
set -e
cd "$(dirname "$0")/.."
for f in rules.js daily.js daily-lines.js; do
  cp "js/$f" "supabase/functions/_shared/app/$f"
done
echo "synced js/{rules,daily,daily-lines}.js -> supabase/functions/_shared/app/ (now redeploy api and notify)"
