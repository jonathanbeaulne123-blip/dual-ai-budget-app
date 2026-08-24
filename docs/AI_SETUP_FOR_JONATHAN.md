# Turn on Hearth's three-AI setup

This page is intentionally slow and literal. Do one numbered line at a time. If a button is missing or the words on your screen are different, stop. Do not guess. Ask Codex with a screenshot.

## What is already done for you

The repository now contains:

- one shared Hearth constitution;
- a mastermind setup for Codex;
- an implementation setup for Cursor;
- a UX and Hercules setup for Claude;
- read-only reviewers;
- safety checks for dangerous shell and MCP actions;
- documentation-only Supabase access;
- one command, `pnpm check`, for the full proof gate;
- CI checks for every pull request.

Nothing in this setup deployed Hearth, changed the books, changed Supabase rows, applied schema, read secrets, or touched Production.

## A. Wait for the clean replacement pull request

Pull request #66 was built on an obsolete roadmap branch and must not be merged. Its useful configuration was rebuilt from current `main` in a clean replacement pull request.

1. Open clean replacement pull request **#88**, linked from the closing comment on pull request #66.
2. Scroll to **Checks** near the bottom.
3. If any check is red, stop and ask Codex to review it.
4. If every required check is green, read the changed files or ask Codex for a final review.
5. Merge only when Jonathan is satisfied.
6. Start the activation steps below only after the replacement is merged.

## B. Turn on Codex

1. Open the Codex app.
2. Click **Open folder**.
3. Choose the real folder that contains the cloned `dual-ai-budget-app` repository.
4. Make sure you can see files such as `package.json`, `src`, and `AGENTS.md` together.
5. Start a new task. Old tasks do not reload changed `AGENTS.md` instructions.
6. If Codex asks whether you trust this project, read the folder path.
7. If the path is the real Hearth repository, click **Trust**.
8. If Codex shows a new hook warning, confirm that the command points to `.codex/hooks/hearth-policy.mjs` inside this repository.
9. Click the option that trusts that reviewed hook.
10. Type: `Use the hearth-worksession skill. Tell me the current branch and do not change files.`
11. Check that Codex names the branch and treats itself as the coordinator.

The Supabase tool is documentation-only. If a browser asks you to sign in to Supabase, you may sign in, but do not select or connect the current household project for AI database access.

## C. Turn on Cursor

1. Open Cursor.
2. Click **File** in the top-left corner.
3. Click **Open Folder**.
4. Choose the real `dual-ai-budget-app` folder.
5. Open **Cursor Settings**.
6. Click **Agents**.
7. Click **Approvals & Execution**.
8. Choose **Auto-review**.
9. Do not choose **Run Everything**.
10. Turn the sandbox on.
11. Choose the network option that uses `sandbox.json` only.
12. Open **Tools & MCP**.
13. Confirm that the only project Supabase server is named **supabase-docs**.
14. If you see a server connected to the household project, turn it off and stop.
15. Start a new Cursor chat.
16. Type: `Use hearth-implement. Inspect only and tell me your role.`
17. Confirm that Cursor says it is the default implementer and does not edit yet.

Optional Bugbot setup:

1. Open the repository on GitHub.
2. Open the Cursor Bugbot settings for the repository.
3. Turn Bugbot on if your Cursor plan includes it.
4. Choose **High** effort for money, Auth, RLS, sync, and Hercules-payload pull requests.
5. Turn on failure for unresolved issues before making Bugbot a required GitHub check.

## D. Turn on Claude Code

1. Open Claude Code in the real Hearth repository.
2. Start a new session so it loads `CLAUDE.md`.
3. Type `/status` and press Return.
4. Confirm that project settings are listed.
5. Type `/context` and press Return.
6. Confirm that both `CLAUDE.md` and imported `AGENTS.md` appear.
7. Type `/mcp` and press Return.
8. Confirm that Supabase is documentation-only and the URL does not contain a household project reference.
9. Type `/config` and press Return.
10. Confirm that the output style is **Hearth design lead**.
11. Type: `Use hearth-design-review to inspect Home. Do not edit.`
12. Confirm that Claude describes itself as the UX and Hercules lead.

## E. Protect `main` in GitHub

Codex cannot safely choose your account-wide repository policy for you. These clicks require your GitHub owner account.

1. Open the repository on GitHub.
2. Click **Settings**.
3. In the left menu, click **Rules**.
4. Click **Rulesets**.
5. Click **New ruleset**.
6. Click **New branch ruleset**.
7. Name it `Protect main`.
8. Set the enforcement status to **Active**.
9. Under target branches, include the default branch, `main`.
10. Turn on **Require a pull request before merging**.
11. Turn on **Require status checks to pass**.
12. Select the CI check only after one successful pull request has made it appear in the list.
13. Turn on **Block force pushes**.
14. Turn on **Block deletions**.
15. Review the page one more time.
16. Click **Create**.

If GitHub warns that your plan does not enforce a rule on a private repository, leave the rule saved and ask Codex what your plan supports.

## F. Database access for AIs later

Do not point an AI at the current household Supabase project. It contains household snapshot transport and does not yet have the Auth plus closed-RLS boundary required for private access.

If you later want an AI to inspect a database:

1. Create a separate Supabase project named **Hearth AI Development**.
2. Put only fictional demo data in it.
3. Do not copy household rows into it.
4. Ask Codex to update the MCP files with that new project reference.
5. Keep `read_only=true`.
6. Keep only the `docs`, `database`, and `debugging` feature groups.
7. Keep manual approval on.

Never paste a database password, service-role key, `.env` file, or household export into chat.

## The three sentences to remember

1. **Codex decides and coordinates.**
2. **Cursor implements and proves.**
3. **Claude makes the experience excellent and honest.**

All three must stop at the same money, privacy, Production, and release boundaries.
