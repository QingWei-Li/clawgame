import { BOARD_SIZE, type Cell, type GameState, type PlayerSide } from '@clawgame/shared';

export type AiAuth = {
  token: string;
  name: string;
};

export async function registerAi(baseUrl: string, name: string, provider = 'codex', model = 'gpt-5'): Promise<AiAuth> {
  const res = await fetch(`${baseUrl}/api/ai/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, provider, model }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const data = await res.json();
  return { token: data.token, name };
}

export async function createAiRoom(baseUrl: string, ai: AiAuth) {
  const res = await fetch(`${baseUrl}/api/rooms`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ai.token}`,
    },
    body: JSON.stringify({ actorType: 'ai', name: ai.name }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<{ roomId: string; seatToken: string; state: GameState }>;
}

export async function joinAiRoom(baseUrl: string, ai: AiAuth, roomId: string) {
  const res = await fetch(`${baseUrl}/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ai.token}`,
    },
    body: JSON.stringify({ actorType: 'ai', name: ai.name }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<{ seatToken: string; state: GameState }>;
}

export async function getState(baseUrl: string, roomId: string): Promise<GameState> {
  const res = await fetch(`${baseUrl}/api/rooms/${roomId}/state`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<GameState>;
}

export async function move(baseUrl: string, roomId: string, seatToken: string, x: number, y: number): Promise<GameState> {
  const res = await fetch(`${baseUrl}/api/rooms/${roomId}/move`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${seatToken}`,
    },
    body: JSON.stringify({ x, y }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<GameState>;
}

function checkWinner(board: Cell[][], x: number, y: number, side: PlayerSide): boolean {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    let count = 1;
    let nx = x + dx;
    let ny = y + dy;
    while (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE && board[ny][nx] === side) {
      count += 1;
      nx += dx;
      ny += dy;
    }
    nx = x - dx;
    ny = y - dy;
    while (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE && board[ny][nx] === side) {
      count += 1;
      nx -= dx;
      ny -= dy;
    }
    if (count >= 5) {
      return true;
    }
  }
  return false;
}

function emptyCells(board: Cell[][]): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] === 0) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

export function chooseMove(state: GameState, mySide: PlayerSide): { x: number; y: number } {
  const board = state.board.map((row) => [...row]);
  const opponent = mySide === 1 ? 2 : 1;
  const candidates = emptyCells(board);

  for (const c of candidates) {
    board[c.y][c.x] = mySide;
    if (checkWinner(board, c.x, c.y, mySide)) {
      board[c.y][c.x] = 0;
      return c;
    }
    board[c.y][c.x] = 0;
  }

  for (const c of candidates) {
    board[c.y][c.x] = opponent;
    if (checkWinner(board, c.x, c.y, opponent)) {
      board[c.y][c.x] = 0;
      return c;
    }
    board[c.y][c.x] = 0;
  }

  const centerFirst = candidates.find((c) => c.x === 7 && c.y === 7);
  if (centerFirst) {
    return centerFirst;
  }

  const random = candidates[Math.floor(Math.random() * candidates.length)];
  return random;
}
