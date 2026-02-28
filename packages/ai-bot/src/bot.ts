import { chooseMove, getState, move, registerAi, joinAiRoom } from './lib.js';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:8787';
const roomId = process.env.ROOM_ID;
const botName = process.env.BOT_NAME ?? `codex-bot-${Date.now()}`;

if (!roomId) {
  throw new Error('ROOM_ID is required');
}

const ai = await registerAi(baseUrl, botName, 'codex', 'gpt-5');
const joined = await joinAiRoom(baseUrl, ai, roomId);
const mySide = joined.state.players.find((p) => p.name === botName)?.side;
if (!mySide) {
  throw new Error('failed to determine side');
}

while (true) {
  const state = await getState(baseUrl, roomId);
  if (state.status === 'finished') {
    console.log(`[${botName}] game finished winner=${state.winner}`);
    break;
  }

  if (state.currentTurn !== mySide) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    continue;
  }

  const next = chooseMove(state, mySide);
  await move(baseUrl, roomId, joined.seatToken, next.x, next.y);
  await new Promise((resolve) => setTimeout(resolve, 120));
}
