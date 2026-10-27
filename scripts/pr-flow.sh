#!/usr/bin/env bash
# Usage: pr_flow.sh <branch> <title> <body-file>
# Pushes local main's new commits as <branch>, opens a PR to main, waits for CI,
# merges it, waits for the main deploy run and prints its result.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
REPO=eras-tcg/eras-web
GH="env -u GH_TOKEN gh"
branch="$1"; title="$2"; body="$3"

env -u GH_TOKEN git push -q origin "HEAD:refs/heads/$branch" || exit 1
url=$($GH pr create -R $REPO --base main --head "$branch" --title "$title" --body-file "$body") || exit 1
echo "PR: $url"
sleep 10
run=$($GH run list -R $REPO --branch "$branch" --event pull_request --limit 1 --json databaseId --jq '.[0].databaseId')
$GH run watch "$run" -R $REPO --exit-status >/dev/null 2>&1
pr_status=$?
$GH run view "$run" -R $REPO --json jobs --jq '.jobs[] | "  PR \(.name): \(.conclusion)"'
if [ $pr_status -ne 0 ]; then echo "PR CI FAILED"; $GH run view "$run" -R $REPO --log-failed 2>&1 | tail -40; exit 2; fi

$GH pr merge "$url" -R $REPO --merge --delete-branch >/dev/null 2>&1 || { echo "MERGE FAILED"; exit 3; }
echo "merged"
env -u GH_TOKEN git fetch -q origin main && git merge -q --ff-only origin/main 2>/dev/null || git reset -q --soft origin/main
sleep 10
run=$($GH run list -R $REPO --branch main --event push --limit 1 --json databaseId --jq '.[0].databaseId')
$GH run watch "$run" -R $REPO --exit-status >/dev/null 2>&1
st=$?
$GH run view "$run" -R $REPO --json jobs --jq '.jobs[] | "  main \(.name): \(.conclusion)"'
$GH run view "$run" -R $REPO --log 2>&1 | grep -E "deployed|applied|::error" | sed 's/.*Z //' | head -5
echo "main run $run exit $st"
exit $st
