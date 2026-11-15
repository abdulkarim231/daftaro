---
name: GitHub access in Replit
description: How to use the authenticated GitHub CLI when the connector remains pending and how to handle guarded Git metadata changes.
---

GitHub's connector status can remain `connect` with an “authorized; addIntegration attaches it” note even after attachment. When that happens, check `gh auth status` without printing its details; the authenticated GitHub CLI may still be available for repository operations.

Some commands that modify workspace Git metadata are blocked unless rerun with `DANGEROUSLY_ALLOW_GIT=1`. Use this only for a narrowly scoped Git operation after the user has approved the repository and action. Never expose credentials or tokens.

**Why:** In this Replit environment, the GitHub connector status did not become `ready`, while the authenticated CLI could list and push to a private repository; the shell separately guarded changes to `.git/config`.

**How to apply:** If GitHub connector calls are unavailable, verify CLI authentication without outputting credentials. Before creating a repository or pushing, confirm the destination, visibility, and user approval; then use the least-broad guarded Git command needed.
