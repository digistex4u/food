#!/usr/bin/env bash
# Creates the GitHub repo and pushes this code to it.
# Needs the GitHub CLI:  brew install gh && gh auth login
set -e
REPO="${1:-bulk-kitchen}"
gh repo create "$REPO" --public --source=. --remote=origin --push \
  --description "Vegetarian mass-gain tracker for an Indian kitchen. Next.js + Postgres."
echo
echo "Pushed. Repo: $(gh repo view --json url -q .url)"
echo "Tell Claude the repo name and it will link Vercel and deploy."
