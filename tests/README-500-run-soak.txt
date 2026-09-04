#413 500-run soak/fuzz gate

Deterministic distribution (500 total):
- 100 Boss victory/PostBoss progression runs
- 100 5v5 simulation/result/navigation runs
- 50 Special Match victory/reward-handoff runs
- 100 final-boss victory/finalization/reward-presentation runs
- 50 legendary persisted-candidate identity runs
- 100 Boss defeat/GameOver/recovery runs

Seasons are round-robin across ie1, ie2, ie1_s2, ie1_s3, orion.
Every failure prints run number, deterministic seed, season, scenario and canonical snapshot.
The gate checks no-deadlock/progression, duplicate roster/lineup/bench/boss/effect identities, activeMatch lifecycle, PostBoss cleanup, failed-save retry behavior, last-life GameOver, legendary offer round-trip identity, and final victory receipt -> Celebration -> Summary exactly once.
