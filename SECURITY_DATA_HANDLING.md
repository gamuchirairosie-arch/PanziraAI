# Database Backup Risk and Response

## Finding

`panzira.db.bak` is tracked in the public repository. A read-only metadata inspection confirmed that it is a non-empty SQLite database and that its schema includes fields capable of storing account, source, location, and editorial information. No record values were displayed or copied during this review.

Treat the file as potentially sensitive until an authorized owner completes a private content review.

## Safeguards in this branch

- `.gitignore` blocks common database backup extensions for future untracked files.
- CI rejects new or modified database and evidence artifacts in a change.
- This branch does not delete the backup, alter its records, or rewrite Git history.

The ignore rule alone cannot protect a file that Git already tracks. The existing exposure remains until the team completes the response below.

## Team response before any history change

1. Name one incident owner and pause unrelated pushes for the cleanup window.
2. Preserve an access-controlled copy for the authorized review. Record its hash and storage owner.
3. Inspect record types privately. Do not paste citizen reports, phone numbers, emails, tokens, source notes, coordinates, or password material into chat or issues.
4. If real personal data or secrets exist, rotate affected credentials and revoke tokens first. Removing a file from Git does not invalidate exposed credentials.
5. Decide whether legal, partner, or participant notification is required.
6. Remove the file from the current tree in a reviewed change while retaining the authorized offline copy.
7. If the file is sensitive, plan a coordinated history rewrite with `git filter-repo` or an equivalent approved tool. Protect tags and releases, notify every collaborator, and require fresh clones afterward.
8. Verify GitHub caches, release assets, forks, CI artifacts, and deployment bundles separately.

Do not perform the history rewrite as a rushed hackathon change. It invalidates commit IDs and can overwrite teammates' work if the branch freeze and communication steps are skipped.
