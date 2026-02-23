# AGENTS.md

This repository uses a feature-preservation workflow. Any code change must start by checking existing behavior and end by verifying it still works.

## Required workflow for every change

1. Read `/Users/arthurberezin/Documents/gymmer/FEATURES.md`.
2. Identify which listed features your change touches.
3. Make the code change.
4. Run `/Users/arthurberezin/Documents/gymmer/scripts/feature_smoke_check.sh`.
5. Run manual checks from the "Manual Regression Checklist" section in `/Users/arthurberezin/Documents/gymmer/FEATURES.md` for all impacted features.
6. If behavior intentionally changes, update `/Users/arthurberezin/Documents/gymmer/FEATURES.md` in the same change.

## Do not merge changes that do any of the following

- Remove or rename core DOM IDs used by timer logic without updating all references.
- Break localStorage compatibility for `gymmer_completions` and `gymmer_session_v1`.
- Change timer phase flow (`prep -> work -> rest`) unintentionally.
- Ship a service worker asset list that does not include app shell files.
- Leave feature docs stale after changing user-visible behavior.
