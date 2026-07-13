# Git & Version Control

## Overview

Git is the version control system underneath every modern delivery pipeline: every CI build,
every pull request, every rollback starts with a commit. This module covers the core model
(commits, branches, remotes), daily workflows, undoing mistakes safely, and team branching
strategies.

**Prerequisites:** Linux module (shell basics). **Estimated time:** 6 hours.

## Key Concepts

### The three areas
```
working directory ──git add──▶ staging area ──git commit──▶ repository (history)
```
`git status` tells you where every change currently sits.

### Daily essentials
```bash
git init / git clone <url>
git add -p                 # stage hunks interactively — review as you stage
git commit -m "feat: add health endpoint"
git log --oneline --graph --all
git diff                   # unstaged; git diff --staged for staged
```

### Branching & merging
```bash
git switch -c feature/login    # create + switch
git merge feature/login        # fast-forward or merge commit
git rebase main                # replay my commits onto main (linear history)
```
- **Merge** preserves history shape; **rebase** rewrites your commits onto a new base.
- Golden rule: **never rebase commits that others have already pulled.**

### Remotes
```bash
git remote -v
git fetch origin               # download refs, touch nothing local
git pull origin main           # fetch + merge (or --rebase)
git push -u origin feature/login
```

### Undoing things (choose the right tool)
| Situation | Command | Rewrites history? |
|---|---|---|
| Unstage a file | `git restore --staged file` | no |
| Discard local edits | `git restore file` | no (destroys edits!) |
| Fix last commit message/content | `git commit --amend` | yes (local only) |
| Undo a pushed commit safely | `git revert <sha>` | no — adds inverse commit |
| Move branch pointer back | `git reset --hard <sha>` | yes — dangerous on shared branches |
| Find "lost" commits | `git reflog` | — your safety net |

### Team workflows
- **Feature-branch + PR:** branch per change, review, squash-merge. Most common.
- **Trunk-based:** tiny short-lived branches (or direct commits) to `main`, heavy CI, feature flags. Powers elite DORA performers.
- **Conventional commits** (`feat:`, `fix:`, `chore:`) enable changelog + semver automation.

## Real-World Examples

**1. Broken commit already pushed to main.** Don't force-push a shared branch. `git revert
<sha>` creates an inverse commit, CI redeploys the previous behavior, history stays intact
for the audit trail.

**2. Hotfix while mid-feature.** You're half-done on `feature/reports` and prod is on fire.
`git stash` (or commit WIP), `git switch -c hotfix/timeout main`, fix, PR, deploy, then back:
`git switch feature/reports && git stash pop`.

**3. Merge conflict during rebase.** `git rebase main` stops on a conflict: edit the marked
files, `git add` them, `git rebase --continue` — or bail out entirely with `git rebase --abort`.

**4. "Who changed this line and why?"** `git blame -L 40,60 app.py` → commit sha →
`git show <sha>` reveals the commit, author, and message. Good commit messages pay off here.

## Step-by-Step Exercises

**Exercise 1 — First repo.** `git init practice && cd practice`, create `README.md`, stage,
commit. Inspect `.git/` briefly (`ls .git`) to demystify it.

**Exercise 2 — Branch & merge.** Create `feature/greeting`, add a file, commit, switch back
to `main`, commit a different file, merge the feature branch. Then repeat with edits to the
*same line* of the same file, and resolve the conflict by hand.

**Exercise 3 — Rewrite vs revert.** Make 3 commits. Use `git commit --amend` on the last,
`git revert HEAD` to undo it publicly, and `git reset --hard HEAD~1` to drop it locally.
Recover the dropped commit with `git reflog` + `git cherry-pick`.

**Exercise 4 — Interactive rebase.** Make 4 messy WIP commits, then
`git rebase -i HEAD~4` and squash them into one well-messaged commit.
