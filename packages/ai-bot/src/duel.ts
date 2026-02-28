import { chooseMove, createAiRoom, getState, joinAiRoom, move, registerAi } from './lib.js';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:8787';
const left = await registerAi(baseUrl, `codex-left-${Date.now()}`, 'codex', 'gpt-5');
const right = await registerAi(baseUrl, `claude-right-${Date.now()}`, 'claude', 'sonnet');

const created = await createAiRoom(baseUrl, left);
const roomId = created.roomId;
const rightJoined = await joinAiRoom(baseUrl, right, roomId);

const tokensBySide = new Map<number, string>();
tokensBySide.set(1, created.seatToken);
tokensBySide.set(2, rightJoined.seatToken);

let rounds = 0;
while (true) {
  const state = await getState(baseUrl, roomId);
  if (state.status === 'finished') {
    console.log(JSON.stringify({ roomId, winner: state.winner, moves: state.moves }));
    break;
  }

  const token = tokensBySide.get(state.currentTurn);
  if (!token) {
    throw new Error('missing seat token by side');
  }

  const action = chooseMove(state, state.currentTurn);
  await move(baseUrl, roomId, token, action.x, action.y);
  rounds += 1;
  if (rounds > 400) {
    throw new Error('too many rounds, likely dead loop');
  }
}
