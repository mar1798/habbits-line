---
description: Split the current changes into meaningful commits and push to the current branch
argument-hint: "[grouping hint, e.g. \"everything in one commit\" or \"docs separately\"]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git reset:*), Bash(git commit:*), Bash(git push:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git show:*), Read, Grep, Glob
---

## Context

- Branch: !`git rev-parse --abbrev-ref HEAD`
- Status: !`git status --short`
- Recent commits (style reference): !`git log --format='%s' -12`

The user's extra wish about grouping: $ARGUMENTS

## Task

Split the uncommitted changes by meaning, commit each group separately and push the
current branch.

### 1. Understand what changed

Read `git diff` and `git diff --cached` in full; do not rely on file names. For new
files, look at their contents. You need to understand **why** each change was made,
otherwise you can neither group it nor write the message.

### 2. Group

One group = one change that is explained by **one sentence of "why"**. Not by directory
and not by file type: the schema edit, migration, repository, store and screen of one
feature are **one** commit, not five. And the other way round: a refactor that landed in
the same files but has nothing to do with the feature is a separate commit.

Signs that a group should be split: the message grows an "and" between unrelated things;
part of the changes could be reverted without breaking the rest; an edit got into the
diff by accident (debug output, reformatting, someone else's junk).

If the user gave a wish in `$ARGUMENTS`, it overrides these rules.

### 3. Check before committing

- Secrets, keys, tokens, local paths, debug `console.log` and commented-out code do not
  go into a commit.
- Files whose changes the user did not ask for and did not mention (especially
  **deletions** and config edits): **ask**, do not include them silently.
- Nothing from `.gitignore`, nothing from `node_modules/`, `out/`, `release/`.
- Do not run checks and tests, that is not this command's job; but if the diff shows an
  obvious breakage, say so before committing.

### 4. Commit

For each group:

```
git add <exact paths>           # never `git add -A` or `git add .`
git diff --cached --stat        # make sure the index holds exactly what was intended
git commit -m "$(cat <<'EOF'
…message…
EOF
)"
```

Message format, in English (older history is in Russian; new commits are English only):

- Subject `Scope: summary` (`Habits:`, `Expenses:`, `Stats:`, `Backup:`, `Reminders:`,
  `UI:`, `i18n:`, `Store:`, `Build:`, `Tests:`, `Docs:`), up to ~70 characters, no
  trailing period. Take the scope from the existing ones; introduce a new one only if
  none fits.
- A blank line, then the body, wrapped at ~72 columns. The body answers "why": what was
  wrong before the change and why it was done this way. What exactly changed is visible
  in the diff; do not retell the diff. For small obvious edits the body can be omitted.
- If the session defines an attribution line (`Claude-Session:` and the like), it goes
  last, separated by a blank line. Add nothing else to the footer.

Do not use `--amend`, `--no-verify`, `--force`; do not touch existing commits. If a hook
fires and the commit fails, find and fix the cause instead of bypassing the hook.

### 5. Push

Push **to the current branch**, as is: do not create a new one and do not switch, even if
it is `master`. This is intended.

```
git push          # if there is no upstream: git push -u origin <current branch>
```

If the push is rejected (the branch moved ahead), do not force: tell the user and
suggest `git pull --rebase`.

### 6. Report

Briefly: which commits were created (hash + subject), what was left uncommitted and why,
the result of the push.
