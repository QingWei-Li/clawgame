import { useEffect, useState, useRef } from 'react';
import { Copy, Check, Users, Shield, Bot, Play, ScrollText } from 'lucide-react';

type Cell = 0 | 1 | 2;
type Status = 'waiting' | 'playing' | 'finished';

type GameState = {
  roomId: string;
  status: Status;
  board: Cell[][];
  currentTurn: 1 | 2;
  winner: 0 | 1 | 2;
  finishReason: 'win' | 'draw_board_full' | 'opponent_timeout' | null;
  moves: number;
  players: { side: 1 | 2; actorType: 'human' | 'ai'; actorId: string; name: string }[];
  lastMove: { x: number; y: number; side: 1 | 2 } | null;
  decisionLogs: {
    moveNo: number;
    side: 1 | 2;
    playerName: string;
    x: number;
    y: number;
    source: 'llm' | 'agent' | 'heuristic';
    thought: string;
    createdAt: number;
  }[];
};

type LiveStats = {
  activePlayers: number;
  activeRooms: number;
  waitingRooms: number;
};

const emptyBoard = () => Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => 0 as Cell));

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const mergedHeaders = new Headers(init?.headers);
  if (!mergedHeaders.has('content-type')) {
    mergedHeaders.set('content-type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers: mergedHeaders,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<T>;
}

export default function App() {
  const [name, setName] = useState('Human Player');
  const [joinName, setJoinName] = useState('Human Guest');
  const [roomInput, setRoomInput] = useState('');
  const [roomId, setRoomId] = useState('');
  const [seatToken, setSeatToken] = useState('');
  const [mySide, setMySide] = useState<0 | 1 | 2>(0);
  const [state, setState] = useState<GameState>({
    roomId: '',
    status: 'waiting',
    board: emptyBoard(),
    currentTurn: 1,
    winner: 0,
    finishReason: null,
    moves: 0,
    players: [],
    lastMove: null,
    decisionLogs: [],
  });
  const [msg, setMsg] = useState('');
  const [copiedRoomPrompt, setCopiedRoomPrompt] = useState(false);
  const [copiedHomePrompt, setCopiedHomePrompt] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats>({ activePlayers: 0, activeRooms: 0, waitingRooms: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);

  function syncRoomToUrl(nextRoomId: string) {
    const url = new URL(window.location.href);
    if (nextRoomId) {
      url.searchParams.set('roomId', nextRoomId);
    } else {
      url.searchParams.delete('roomId');
    }
    window.history.replaceState({}, '', url.toString());
  }

  useEffect(() => {
    const presetRoomId = new URLSearchParams(window.location.search).get('roomId');
    if (presetRoomId) {
      setRoomId(presetRoomId);
      setRoomInput(presetRoomId);
    }
  }, []);

  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        const next = await jsonFetch<LiveStats>('/api/stats/live');
        setLiveStats(next);
      } catch {
        // ignore in home stats poll
      }
    };

    fetchLiveStats();
    const timer = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?roomId=${roomId}`);
    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data) as { type: string; state: GameState };
        if (payload.type === 'state') {
          setState(payload.state);
        }
      } catch {
        setMsg('WebSocket 消息解析失败');
      }
    };

    const timer = setInterval(async () => {
      try {
        const next = await jsonFetch<GameState>(`/api/rooms/${roomId}/state`);
        setState(next);
      } catch {
        // ignore in poll
      }
    }, 1000);

    return () => {
      ws.close();
      clearInterval(timer);
    };
  }, [roomId]);

  useEffect(() => {
    (window as any).render_game_to_text = () =>
      JSON.stringify({
        coordinate: 'origin top-left; x right+, y down+',
        roomId,
        state,
        mySide,
      });
    (window as any).advanceTime = (_ms: number) => {
      return;
    };
  }, [roomId, state, mySide]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.decisionLogs]);

  async function createRoom() {
    setMsg('创建中...');
    try {
      const payload = await jsonFetch<{ roomId: string; seatToken: string; side: 1 | 2; state: GameState }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ actorType: 'human', name }),
      });
      setRoomId(payload.roomId);
      syncRoomToUrl(payload.roomId);
      setSeatToken(payload.seatToken);
      setMySide(payload.side);
      setState(payload.state);
      setMsg('');
    } catch (e) {
      setMsg(`创建失败: ${(e as Error).message}`);
    }
  }

  async function joinRoom() {
    if (!roomInput) return;
    setMsg('加入中...');
    try {
      const payload = await jsonFetch<{ seatToken: string; side: 1 | 2; state: GameState }>(`/api/rooms/${roomInput}/join`, {
        method: 'POST',
        body: JSON.stringify({ actorType: 'human', name: joinName }),
      });
      setRoomId(roomInput);
      syncRoomToUrl(roomInput);
      setSeatToken(payload.seatToken);
      setMySide(payload.side);
      setState(payload.state);
      setMsg('');
    } catch (e) {
      setMsg(`加入失败: ${(e as Error).message}`);
    }
  }

  async function place(x: number, y: number) {
    if (!roomId || !seatToken) return;

    try {
      const next = await jsonFetch<GameState>(`/api/rooms/${roomId}/move`, {
        method: 'POST',
        headers: { authorization: `Bearer ${seatToken}` },
        body: JSON.stringify({ x, y }),
      });
      setState(next);
      setMsg('');
    } catch (e) {
      setMsg(`落子失败: ${(e as Error).message}`);
    }
  }

  const recentLogs = [...state.decisionLogs].slice(-100);
  const homeAiPrompt =
    'Read http://127.0.0.1:8787/skill.md. If no room id is provided, join a waiting room; if none exists, create a room and wait for another AI to join.';
  const roomAiPrompt = roomId
    ? `Read ${window.location.protocol}//${window.location.host}/skill.md, then join room ${roomId}.`
    : '';

  async function copyPrompt(prompt: string, target: 'home' | 'room') {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    if (target === 'home') {
      setCopiedHomePrompt(true);
      setTimeout(() => setCopiedHomePrompt(false), 1500);
      return;
    }
    setCopiedRoomPrompt(true);
    setTimeout(() => setCopiedRoomPrompt(false), 1500);
  }

  const waitingForOpponent = state.players.length < 2 && state.status === 'waiting';

  function renderHome() {
    return (
      <div className="home-container">
        <div className="home-card panel">
          <h1 className="title">ClawGame</h1>
          <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '2rem' }}>
            五子棋 AI 竞技场
          </p>

          <div className="home-stats">
            <span className="home-stats-label">当前玩家数</span>
            <span className="home-stats-value">{liveStats.activePlayers}</span>
            <span className="home-stats-meta">
              活跃房间 {liveStats.activeRooms} · 待匹配 {liveStats.waitingRooms}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="row" style={{ width: '100%' }}>
              <input
                style={{ flex: 1 }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="我的昵称"
              />
              <button onClick={createRoom}><Play size={18} /> 创建房间</button>
            </div>

            <div className="divider">或者 加入已有房间</div>

            <div className="row" style={{ width: '100%' }}>
              <input
                style={{ flex: 1 }}
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="在此输入房间号"
              />
            </div>
            <div className="row" style={{ width: '100%' }}>
              <input
                style={{ flex: 1 }}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="我的昵称"
              />
              <button className="secondary" onClick={joinRoom} disabled={!roomInput}>
                <Users size={18} /> 加入房间
              </button>
            </div>
          </div>

          <div className="panel prompt-panel home-prompt-panel">
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="#38bdf8" /> 复制这段给 AI，自动加入游戏
            </h3>
            <textarea className="prompt-box" value={homeAiPrompt} readOnly />
            <p className="home-prompt-tip">
              这段提示词没有房间号时，AI 会先加入待匹配房间；若不存在待匹配房间，会新建房间并等待其他 AI 加入。
            </p>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => copyPrompt(homeAiPrompt, 'home')}>
                {copiedHomePrompt ? <Check size={16} /> : <Copy size={16} />}
                {copiedHomePrompt ? '已复制' : '复制提示词'}
              </button>
            </div>
          </div>

          {msg && <p style={{ color: '#ef4444', textAlign: 'center', marginTop: '1rem' }}>{msg}</p>}
        </div>
      </div>
    );
  }

  function renderRoom() {
    return (
      <div style={{ width: '100%' }}>
        <div className="room-header">
          <h2 style={{ margin: 0 }}>
            <span style={{ color: '#38bdf8' }}>Claw</span>Game Arena
          </h2>
          <div className="room-id-badge">ID: {roomId}</div>
        </div>

        {waitingForOpponent && (
          <div className="panel prompt-panel">
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="#38bdf8" /> 等待对手加入... 请将以下提示词发送给 AI
            </h3>
            <textarea className="prompt-box" value={roomAiPrompt} readOnly />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => copyPrompt(roomAiPrompt, 'room')}>
                {copiedRoomPrompt ? <Check size={16} /> : <Copy size={16} />}
                {copiedRoomPrompt ? '已复制' : '复制提示词'}
              </button>
            </div>
          </div>
        )}

        <div className="game-container">
          <div className="board-wrapper">
            <div className="board-info">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="status-badge">
                  {state.status === 'playing' ? '进行中' : state.status === 'finished' ? '已结束' : '等待中'}
                </span>
                <span>
                  当前回合: {state.currentTurn === 1 ? '黑棋 (先手)' : '白棋'}
                </span>
              </div>
              <div>回合数: {state.moves}</div>
            </div>

            <div style={{ marginBottom: '16px', color: '#e2e8f0', display: 'flex', justifyContent: 'center', gap: '24px' }}>
              {state.players.length === 0 ? (
                <span style={{ color: '#64748b' }}>暂无玩家</span>
              ) : (
                state.players.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color={p.side === 1 ? '#94a3b8' : '#f8fafc'} />
                    <span style={{ fontWeight: state.currentTurn === p.side ? 'bold' : 'normal', color: state.currentTurn === p.side ? '#38bdf8' : 'inherit' }}>
                      {p.side === 1 ? '黑' : '白'}: {p.name} {p.actorType === 'ai' && <Bot size={14} style={{ display: 'inline', marginLeft: 4 }} />}
                    </span>
                  </div>
                ))
              )}
            </div>

            {state.status === 'finished' && (
              <div style={{
                margin: '16px 0', padding: '16px',
                background: '#fef2f2',
                border: '4px solid #f43f5e',
                borderRadius: '12px',
                boxShadow: '4px 4px 0 #fda4af',
                textAlign: 'center',
                color: '#e11d48', fontWeight: 'bold',
              }}>
                {state.winner === 0 ? '平局' : `${state.winner === 1 ? '黑棋' : '白棋'} 获胜！`}
                {state.finishReason && <span style={{ fontSize: '0.85em', fontWeight: 'normal', display: 'block', marginTop: 4, color: '#94a3b8' }}>原因: {state.finishReason}</span>}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="grid">
                {state.board.map((row, y) =>
                  row.map((cell, x) => (
                    <button
                      key={`${x}-${y}`}
                      className="cell"
                      onClick={() => place(x, y)}
                      disabled={cell !== 0 || state.status !== 'playing' || state.currentTurn !== mySide}
                      aria-label={`cell-${x}-${y}`}
                    >
                      {cell !== 0 && (
                        <span className={`stone ${cell === 1 ? 'black' : 'white'}`} />
                      )}
                      {state.lastMove?.x === x && state.lastMove?.y === y && (
                        <span className="last-move-indicator" />
                      )}
                    </button>
                  )),
                )}
              </div>
            </div>

            {msg && <p style={{ color: '#ef4444', textAlign: 'center', marginTop: '1rem' }}>{msg}</p>}
          </div>

          <div className="log-panel panel">
            <div className="log-header">
              <ScrollText size={20} color="#38bdf8" />
              <h3>AI 决策日志</h3>
            </div>
            <div className="log-content">
              {recentLogs.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>暂无日志输出</p>
              ) : (
                recentLogs.map((log) => (
                  <div className="log-item" key={`${log.moveNo}-${log.createdAt}`}>
                    <div className="log-meta">
                      <span>#{log.moveNo} {log.side === 1 ? '黑' : '白'}({log.playerName})</span>
                      <span>({log.x}, {log.y}) - {log.source}</span>
                    </div>
                    <div className="log-text">{log.thought}</div>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!roomId ? renderHome() : renderRoom()}
    </>
  );
}
