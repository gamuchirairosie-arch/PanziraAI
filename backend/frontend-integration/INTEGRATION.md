# Swapping the frontend from localStorage to the API

Add `src/api/client.ts` (from `apiClient.ts`), set `VITE_API_URL`, and replace the matching action in
`PanziraContext.tsx`. Response shapes already match `src/types.ts`.

| PanziraContext today | Call instead | Notes |
|---|---|---|
| `INITIAL_SIGNALS` + `persisted.signals` | `api.signals()` | needs a journalist/editor login |
| `INITIAL_VERIFIED_ALERTS` | `api.publicAlerts()` | no login; this is the public dashboard feed |
| `CORRIDOR_WATCHLIST` | `api.corridors()` | scores come from real reports |
| counts (`totalSignalsCount`, ...) | `api.stats()` | `autoPublishedByAiCount` is always 0 |
| `submitCitizenReport(input)` | `api.submitReport({...})` | send the `File`, not a data URL; keep `{id, trackingToken}` for "my reports" |
| "my reports" view | `api.trackReport(id, token)` | status only, no internal data |
| `toggleChecklist` | `api.toggleChecklist(id, item, value)` | status moves automatically |
| `updateEditorialNotes` | `api.updateNotes` | debounce |
| `requestEvidence` | `api.requestEvidence` | |
| `rejectSignal` / `verifySignal` | `api.rejectSignal` / `api.verifySignal` | editor only; a 403/409 message is user-readable |
| `toggleGraphicReveal` | `api.revealGraphic(evidenceId)` | returns a 2-minute URL; audited |
| `openWorkingBriefForSignal`, `saveBriefDraft` | `api.openBriefForSignal`, `api.saveBrief` | `version` gives edit-conflict detection |
| (new) fix AI suggestions | `api.editFields`, `api.confirmTranslation` | needed before a Shona/Ndebele report can publish |

Changes the UI needs beyond a swap:
* A login screen (the newsroom portal now needs a token; the public portal does not).
* `SignalReport.photoPreviewUrl` / `photoFullUrl` replace `customPhotoDataUrl`; prefix with `mediaUrl()`.
* Show `aiUncertainty[]` and `translationReviewed`; disable "Verify" until the translation is confirmed.
* `mapCoords` are % of the Bulawayo viewport, clamped to the edge for points outside it (e.g. Plumtree).
  `lat`/`lng` are also returned if you later move to a real map.
* Remove the hard-coded "Rudo Moyo": use the logged-in user's name (the server already does).
