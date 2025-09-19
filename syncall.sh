# Syncs all local branches after a pull request is merged on origin/main
# dev branch is rebased onto main each time the script is run
# To run from the project root, run ./syncall.sh in a bash terminal

#!/bin/bash

set -e

echo "Checking out main branch..."
git checkout main || { echo "Failed to checkout main branch"; exit 1; }

echo "Pulling latest changes on main..."
git pull origin main || { echo "Failed to pull origin/main"; exit 1; }

echo "Checking out dev branch..."
git checkout dev || { echo "Failed to checkout dev branch"; exit 1; }

echo "Rebasing dev onto main..."
if ! git rebase main
then
  echo "Rebase encountered conflicts or errors."
  echo "Please resolve the conflicts, then run 'git rebase --continue' manually."
  echo "After finishing rebase, press ENTER to continue..."
  read -r

  # Double check if rebase still in progress
  if git rebase --show-current-patch > /dev/null 2>&1
  then
    echo "Rebase still in progress. Please complete the rebase first."
    exit 1
  fi
fi

echo "Pushing updated dev branch to origin..."
git push origin dev || { echo "Failed to push dev branch"; exit 1; }

echo "Sync process complete."
