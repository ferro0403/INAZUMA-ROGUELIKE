# Pull Candidates — extraction boundary

This checkpoint exists before physically removing the Pull candidate block from `js/app.js`.

## Ownership to move out of app.js

The Pull Candidates domain will own:

- canonical candidate identity lookup through `RecruitmentPoolRuntime`;
- owned-player exclusion;
- `excludedCandidateIds` filtering;
- deterministic seed construction for candidate generation;
- normal, weighted and Legendary candidate selection dispatch;
- post-selection canonical dedupe;
- persisted `candidateIds` resolution.

## Not owned here

This module does not own:

- modal/UI rendering;
- recruitment or roster replacement;
- node completion;
- RunStorage;
- cloud persistence;
- Scout Token or Lucky Charm inventory mutation;
- boss flow, 5v5, secondary 11v11, game over or finalization.

## Extraction rule

The first wiring change in `app.js` must be behavior-preserving: calls currently handled by `generatedPullCandidates()` and `pullCandidates()` are delegated to `PullCandidatesRuntime` with the same inputs and outputs. No duplicate fix is allowed in that wiring commit.

Only after parity is verified may the functional invariant change be introduced: three displayed candidates must represent three distinct canonical player IDs whenever at least three distinct eligible canonical players exist.
