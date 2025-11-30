# PRE-COMMIT CHECKLIST
**STOP. Do not commit yet.**

1.  **CHECK UNTRACKED FILES:** 
    *   Run `git status`.
    *   Look specifically at the **"Untracked files"** section.
    *   Are there *any* files I created in previous turns (e.g., `src/hack/`, `src/util/`) that are missing from the stage? **Stage them.**

2.  **VERIFY STAGED CONTENT:**
    *   Run `git diff --staged --name-only`.
    *   Does the list match my mental model of the "Feature"? 
    *   If I see `share.js` and `daemon.js` but missed `grow.js`, **STOP** and find it.

3.  **DRAFT THE MESSAGE:**
    *   **Format:** `type(scope): Description` (Conventional Commits).
    *   **Content:** Describe the **NET RESULT** of the changes.
        *   *BAD:* "Fixed the thing I broke, then moved it, then renamed it."
        *   *GOOD:* "feat: Implement [Feature] and refactor [Component]."
    *   **Completeness:** Ensure the message body mentions *every* significant file modification.
