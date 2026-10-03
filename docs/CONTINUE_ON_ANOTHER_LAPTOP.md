# Continue Kasa on another laptop

Checkpoint saved on 2026-10-03T19:11:38+00:00.

## Project and current source

- Public software: https://genovesi-jm.github.io/Kasa/
- Repository: https://github.com/Genovesi-JM/Kasa
- Main development branch: `presentation-prototype`.
- This independent backup branch: `handoff/laptop-20261003-191134`.
- Committed baseline captured: `71a7cca112d04e13cd6dd83c492c36333567c420` (six-language viewing workflow, release 54).
- Release 53 added current agreed-viewing calendar downloads. The release 54 full check log completed successfully before this checkpoint. Source is on GitHub; check the current main development branch and public site for newer publishing progress.

The original task may keep advancing on the first laptop. Fetch the latest `presentation-prototype` before starting. This branch preserves the source captured here, including unfinished work; do not overwrite newer commits with this snapshot. The checkpoint does not certify unfinished changes as tested or ready to deploy.

## Unfinished work captured

Files changed relative to the committed baseline:

- `scripts/ui-state-check.ts`
- `src/components/propertyRequestState.ts`
- `scripts/viewing-action-command-check.ts`

The next work item is release 55: make immediate viewing actions use captured commands and receipts from the exact committed history event. Owner acceptance must not overwrite a cancellation queued first; tenant proposal decisions must not act on a replacement proposal. Preserve newer private drafts, unrelated records and later navigation. Success feedback and keyboard focus must follow only the exact successful result, with localized rejection for a failed result. A controlled queued-handler reproduction is test evidence, not a claim that the race was reproduced through normal browser interaction. Read `docs/HANDOFF_R55_CHECKS.txt` for the prepared checks. The UI and regression work may still be incomplete in this backup; compare against the latest main development branch.

## Start locally

Use Node.js 24 and Git. For the latest development code:

```sh
git clone --branch presentation-prototype https://github.com/Genovesi-JM/Kasa.git
cd Kasa
npm ci
npm run dev
```

The app opens at http://127.0.0.1:5173. To also run the local API, follow the environment-example instructions in `README.md` and use `npm run dev:all`. Do not copy or commit private environment files.

For this exact checkpoint instead, clone the branch named above. Before publishing software changes, run `npm run check`, verify the actual workflows in the browser and follow the existing Pages staging instructions in `README.md`. Preserve old hashed assets for already-open sessions.

## Product scope and boundaries

Continue improving the software itself, not the optional presentation. Read `BUSINESS_RULES.md`, `VISUAL_SYSTEM.md` and `docs/FUNCTION_STATUS.md` first. Prioritize usable end-to-end workflows, navigation, phones, role isolation, private drafts and truthful results. Public hosting remains independent GitHub Pages.

The code and this handoff are online. In-app sample records, private drafts and selected files are currently held in the browser tab and are not synchronized between laptops; reload resets them. Production authentication, persistent storage, messaging and other integrations remain unconnected. Do not report them as working production services. Kasa does not broker property deals or hold rent/deposits; Spaces remains sports/events rather than overnight accommodation.

No private environment files, credentials or browser-entered records were included in this checkpoint.
