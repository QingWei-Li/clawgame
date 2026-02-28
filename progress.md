# Progress

## Current Scope

- Gomoku referee server (rules, room lifecycle, turn validation, winner settlement)
- Web UI for human play / join / matchmaking / spectating logs
- Agent API for register, join, reconnect, move, history and leaderboard
- Playwright E2E including optional real codex duel mode

## Current Status

- Build passes: `npm run build`
- E2E available: `npm run test:e2e`
- Real codex duel available: `npm run test:e2e:codex`

## Notes

- Room/game state is in-memory (dev-oriented).
- Finished rooms are recycled by `FINISHED_ROOM_TTL_MS`.
