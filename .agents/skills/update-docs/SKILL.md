---
name: update-docs
description: Reconcile template-expo documentation with branch or staged changes. Use when asked to update README, AGENTS, product docs, or other maintained documentation after code or configuration changes in this monorepo.
---

# Update Monorepo Documentation

Make small, evidence-based documentation edits that describe the repository's current state. Change documentation only; do not refactor code or create a commit or pull request.

## Determine the change set

Work from the repository root and inspect the current branch, status, and `origin/HEAD` when available.

- On a feature branch, analyze `git diff <default-branch>...HEAD` and include staged and unstaged changes.
- On the default branch, analyze staged changes. Include unstaged changes only when the user explicitly identifies them as the work to document.
- If there is no relevant diff, report that there is nothing to reconcile and stop.

List changed files first, then read meaningful diffs. Skip lockfile churn, generated native directories, generated output, and locale-value churn unless it changes a documented contract.

## Respect monorepo ownership

Classify each change before choosing documentation targets:

- Root workspace, shared architecture, repository-wide commands, and conventions: inspect `README.md` and `AGENTS.md`.
- One app's product behavior, release checklist, configuration, or app-owned paths: inspect `apps/<slug>/docs/PRODUCT.md` and any affected app-local docs.
- Shared core, ads, Fastlane, scripts, generators, or setup behavior: inspect root docs plus nearby maintained docs under `packages/` or `docs/` when present.
- Changes to app creation must also be checked against `apps/starter` and `packages/tooling/scripts/create-app.ts` so newly generated apps remain accurately documented.

Do not touch files under `.claude/` or `CLAUDE.md`. This repository's reusable agent guidance lives in `AGENTS.md`, and Codex skills live under `.agents/skills/`.

Never copy app-specific identities, service values, assets, or product claims into shared documentation. When the same contract appears in root and app docs, update each relevant owner consistently.

## Decide whether docs need changes

Update documentation only when a future developer or agent would otherwise be misled, for example when the change adds or alters:

- a command, setup or release workflow;
- an app/shared ownership boundary;
- a public component, hook, service, configuration shape, or persisted contract;
- a documented path, symbol, feature, permission, integration, or release requirement.

Skip private implementation details, fixes that preserve documented behavior, and refactors with no user-facing or architectural contract change. If the docs remain accurate, say so explicitly.

## Propose before editing

Show targeted proposed edits grouped by file as unified `diff` fences with 1–2 unchanged context lines per hunk. Keep the wording terse and match the surrounding style. Do not rewrite whole sections or add history sections.

Ask the user which proposed files to apply. Apply only the accepted subset with a patch, inspect the final diff, and report changed and intentionally untouched docs.

Use backticks for repository paths and commands. Do not add emojis, personal branding, generated changelogs, or speculative future behavior.
