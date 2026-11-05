# Panzira Hackathon Demo Proof

## Honest current status

The React frontend builds and its new acknowledgement tests pass. The public frontend is reachable, but the same-origin health and public API routes return 404. A hosted backend and shared cross-device persistence remain unverified.

The safe presentation path is the explicit local demo. It uses fictional records, stores changes only in the browser, and labels simulated approvals as local previews. Do not describe the current public site as a live newsroom service.

## Five minute demonstration checklist

1. Show the top banner and say that the current run is browser-only.
2. Submit one fictional road hazard with no real phone number, identity, or distressing image.
3. Show the receipt. Point out that it says the report was not sent or published.
4. Open the verification workspace. Complete only three checks and show that approval remains locked.
5. Complete the fourth check. Explain that a production deployment would still require backend acknowledgement.
6. Select the local simulation button. Show the demo-only alert preview and the message confirming that no server or integration was contacted.
7. End with the separate backend deployment plan and the test evidence below.

## Reproducible technical evidence

Run from the repository root:

```text
npm ci
npm test
npm run build
```

Expected frontend evidence for this branch:

- Four acknowledgement and gate tests pass.
- TypeScript and Vite production build complete.
- The build may report the existing large-bundle warning. Treat that as a performance backlog item, not a failed build.

Backend evidence:

- The repository contains API tests for the human editor role, the four-check gate, AI non-publication, rejection, withdrawal, and cross-session persistence.
- Draft PR Linux CI completed the backend suite with 64 tests passing.
- During this review, Windows Application Control blocked a downloaded SciPy DLL before local test collection. State that the full backend suite passed in Linux CI, not locally.

## Verified and proposed features

| Capability | Status to state on stage | Proof or limit |
| --- | --- | --- |
| Browser demo workflow | Verified locally | Frontend tests and production build pass |
| Four-check editorial gate | Implemented | Frontend gate tests and backend gate tests in the repository |
| Backend test suite | Verified in draft PR CI | 64 tests passed; deprecation and short test-key warnings remain |
| Hosted frontend | Verified reachable | Homepage returned HTTP 200 on 5 November 2026 |
| Hosted backend | Not verified | Same-origin health and API routes returned 404 |
| Shared persistence | Proposed deployment | Requires separate FastAPI service and durable database |
| WhatsApp, Telegram, SMS, USSD | Integration code or simulation only | Credentials and production delivery were not tested in this review |
| RSS monitoring | Prototype code | Requires authorized sources, a running backend, and observed collection logs |
| Traction or paying customers | No verified evidence supplied | Do not claim users, revenue, or partnerships without documents |

## Cost assumptions for a 90 day pilot

These are planning assumptions, not vendor quotes. Replace them with Zimbabwe-specific supplier quotes before funding decisions.

| Cost item | Assumption | 90 day range |
| --- | --- | ---: |
| Backend application hosting | Small paid service with logs and health checks | US$45 to US$90 |
| Managed PostgreSQL | Entry paid tier with backups | US$45 to US$90 |
| Private evidence storage | Low-volume images and retention controls | US$15 to US$30 |
| Messaging and USSD | Controlled pilot volume; highly usage-dependent | US$150 to US$600 |
| Domain, monitoring, incident reserve | Basic operations allowance | US$60 to US$150 |
| Editorial training and field validation | Team time, transport, and newsroom workshops | Quote locally |

The infrastructure subtotal is US$315 to US$960 before team time, devices, data bundles, travel, legal review, and contingency.

## Evidence sources

- Supplied scorecard: `ZMC NUST Media Innovation Hackathon Judging Criteria - 4 Nov 2026(1).docx`.
- Reviewed code baseline: `gamuchirairosie-arch/PanziraAI` at commit `b69485aa120c376184b58bcefc295eb1ad8f689e`.
- Public frontend observed at `https://panzira-ai.vercel.app/` on 5 November 2026.
- Same-origin diagnostics observed on 5 November 2026: `/health`, `/api/public/alerts`, and `/api/v1/public/alerts` returned HTTP 404.
- Branch evidence: the test commands and successful frontend, backend, and database-artifact CI jobs in draft PR #1.

## 100 point judging alignment

| Criterion | Weight | Evidence to show | Limit to state clearly |
| --- | ---: | --- | --- |
| Innovation and Creativity | 20 | Human gated AI intake, multilingual drafts, duplicate and location support | AI assists; it does not verify or publish |
| Relevance to Media Challenges | 20 | Evidence handling and newsroom corroboration before public alerts | Current demo uses fictional incidents |
| Technical Execution | 15 | Passing frontend tests, production build, 64-test backend CI, static model and data-artifact guards | Dependency deprecation and short test-key warnings remain |
| Feasibility and Sustainability | 15 | Separate deployment plan and 90 day cost assumptions | No hosted backend or verified customers yet |
| Social Impact | 10 | Safer public communication design and privacy controls | No measured community outcome or adoption data supplied |
| Scalability | 10 | Channel adapters, versioned API, durable database plan | Integrations have not been load tested or operated in production |
| Presentation and Demonstration | 10 | Rehearsed five minute fictional demo with failure-state proof | Do not improvise real reports or outbound alerts |

## Presenter split

Theophelus opens with the newsroom problem, explains why verification matters, and closes with impact and the honest pilot ask.

Efraim explains the technical workflow, runs the four-check demo, shows the failed-success protection, and states the backend deployment limit.
