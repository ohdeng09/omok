import { BOARD_SIZE, createBoard, getWinner, isBoardFull, placeStone } from '/src/rules.js?v=20260528-cache-fix';
import { chooseAiMove } from '/src/ai.js?v=20260528-cache-fix';

const app = document.querySelector('#app');
const CACHE_BUST_PARAM = '20260528-cache-fix';
const PUBLIC_APP_URL = 'https://omok-h9o2.onrender.com/?fresh=20260528-cache-fix';
const SOUND_STORAGE_KEY = 'omok:sound-muted';
const sound = createSoundEngine();
const initialParams = new URLSearchParams(location.search);
cleanRuntimeUrl(initialParams);
const state = {
  nickname: localStorage.getItem('omok:nickname') || '',
  player: null,
  room: null,
  source: null,
  solo: null,
  pendingRoomCode: normalizeRoomCode(initialParams.get('room') || ''),
  lastOnlineRoomCode: null,
  lastOnlineMoveCount: null,
  lastOnlineResultKey: null,
  lastOnlineStatus: null,
  lastOnlinePlayerCount: null,
  savedResultFor: null,
  record: JSON.parse(localStorage.getItem('omok:record') || '{}')
};

registerServiceWorker();
renderLobby();

function renderLobby(message = '') {
  closeRoomStream();
  app.innerHTML = `
    <section class="hero">
      <div>
        <h1 class="title">온라인 오목</h1>
        <p class="muted">친구와 방 코드로 바로 붙고, 연승과 미션 점수로 계속 경쟁하세요. 혼자서는 단계별 AI와 점수 목표에 도전할 수 있습니다.</p>
      </div>
      <form class="panel" id="lobby-form">
        <div class="top-row"><span class="badge">대기실</span>${soundControlHtml()}</div>
        <label>닉네임<input name="nickname" maxlength="18" value="${escapeHtml(state.nickname)}" required /></label>
        <div class="actions">
          <div class="option-row">
            <label class="check"><input type="checkbox" name="partyMode" /> 선택형 파티룰 켜기</label>
            ${partyHelpHtml()}
          </div>
          <button name="action" value="create">방 만들기</button>
          <input name="code" placeholder="입장 코드" maxlength="4" value="${escapeHtml(state.pendingRoomCode)}" />
          <button class="secondary" name="action" value="join">방 입장</button>
          <button class="secondary" name="action" value="solo">혼자 하기</button>
        </div>
        ${mobileShareHtml()}
        ${state.pendingRoomCode ? '<p class="muted">초대 링크로 들어왔습니다. 닉네임을 넣고 방 입장을 누르세요.</p>' : ''}
        ${message ? `<p class="muted">${escapeHtml(message)}</p>` : ''}
      </form>
    </section>`;
  document.querySelector('#lobby-form').addEventListener('submit', onLobbySubmit);
  wireSoundControls();
  wireMobileShare();
}

async function onLobbySubmit(event) {
  event.preventDefault();
  await sound.unlock();
  const data = new FormData(event.submitter.form);
  const action = event.submitter.value;
  state.nickname = data.get('nickname').trim() || 'Player';
  localStorage.setItem('omok:nickname', state.nickname);
  if (action === 'solo') return startSolo();

  try {
    if (action === 'create') {
      const result = await post('/api/rooms', {
        nickname: state.nickname,
        partyMode: data.get('partyMode') === 'on'
      });
      state.player = result.player;
      state.room = result.room;
      subscribe(result.room.code);
    } else {
      const code = normalizeRoomCode(data.get('code'));
      if (!code) throw new Error('입장 코드를 입력해주세요.');
      const result = await post(`/api/rooms/${code}/join`, { nickname: state.nickname });
      state.player = result.player;
      state.room = result.room;
      subscribe(code);
    }
    renderOnline();
  } catch (error) {
    renderLobby(error.message);
  }
}

function subscribe(code) {
  closeRoomStream();
  state.lastOnlineRoomCode = code;
  state.lastOnlineMoveCount = null;
  state.lastOnlineResultKey = null;
  state.lastOnlineStatus = null;
  state.lastOnlinePlayerCount = null;
  state.source = new EventSource(`/api/rooms/${code}/events`);
  state.source.onmessage = (event) => {
    state.room = JSON.parse(event.data);
    renderOnline();
  };
  state.source.onerror = () => {
    if (state.room) renderOnline('연결이 잠시 불안정합니다.');
  };
}

function closeRoomStream() {
  if (state.source) state.source.close();
  state.source = null;
}

function renderOnline(connectionMessage = '') {
  const room = state.room;
  const me = room.players.find((player) => player.id === state.player.id);
  const opponent = room.players.find((player) => player.id !== state.player.id);
  handleOnlineAudio(room, me);
  if (room.result) saveOnlineResult(room, me);

  app.innerHTML = `
    <section class="layout">
      <div class="board-wrap">${boardHtml(room.board, room.result?.winnerLine || [], room.blockedCells || [])}</div>
      <aside class="panel">
        <div class="top-row">
          <h2>방 ${room.code}</h2>
          <div class="mini-actions">
            ${room.partyMode ? '<span class="badge">파티룰</span>' : '<span class="badge">정통룰</span>'}
            ${soundControlHtml()}
          </div>
        </div>
        <p class="muted">${connectionMessage || onlineStatus(room, me)}</p>
        ${ruleNoteHtml(room.partyMode)}
        ${room.partyMode ? partyModeSummaryHtml() : ''}
        <div class="stats">
          <div class="stat"><span>나</span><strong>${escapeHtml(me.nickname)} (${colorLabel(me.color)})</strong></div>
          <div class="stat"><span>상대</span><strong>${opponent ? escapeHtml(opponent.nickname) : '대기 중'}</strong></div>
          <div class="stat"><span>수순</span><strong>${room.moves.length}</strong></div>
          ${recordHtml(me.nickname)}
        </div>
        ${room.result ? resultHtml(room, me) : ''}
        <div class="actions">
          <button class="secondary" id="share-room">초대 링크 공유</button>
          ${room.result ? '<button id="rematch">재대결 요청</button>' : ''}
          <button class="secondary" id="leave">로비로</button>
        </div>
      </aside>
    </section>`;
  attachBoardHandlers((row, col) => post(`/api/rooms/${room.code}/move`, { playerId: state.player.id, row, col }).catch((error) => renderOnline(error.message)));
  document.querySelector('#leave')?.addEventListener('click', () => renderLobby());
  document.querySelector('#rematch')?.addEventListener('click', () => post(`/api/rooms/${room.code}/rematch`, { playerId: state.player.id }));
  document.querySelector('#share-room')?.addEventListener('click', () => shareRoom(room));
  wireSoundControls();
}

function onlineStatus(room, me) {
  if (room.status === 'waiting') return '친구에게 코드를 보내주세요.';
  if (room.status === 'finished') return '대국 종료';
  if (room.moves.length === 0) return '먼저 두는 사람이 흑돌 선공입니다.';
  return room.turn === me.color ? '내 차례입니다.' : '상대 차례입니다.';
}

function saveOnlineResult(room, me) {
  const opponent = room.players.find((player) => player.id !== me.id);
  const resultKey = `${room.code}:${room.result.endedAt || `${room.moves.length}:${room.result.winnerColor}`}`;
  if (!room.result || !opponent || state.savedResultFor === resultKey) return;

  const score = room.result.missionsByColor?.[me.color]?.score || 0;
  state.record = updateLocalRecord(state.record, {
    playerName: me.nickname,
    opponentName: opponent.nickname,
    won: room.result.winnerColor === me.color,
    score
  });
  state.savedResultFor = resultKey;
  localStorage.setItem('omok:record', JSON.stringify(state.record));
}

function startSolo(stage = 1, difficulty = 'easy') {
  closeRoomStream();
  state.solo = { board: createBoard(), turn: 'black', stage, difficulty, moves: [], result: null };
  renderSolo();
}

function renderSolo() {
  const solo = state.solo;
  app.innerHTML = `
    <section class="layout">
      <div class="board-wrap">${boardHtml(solo.board, solo.result?.winnerLine || [], [])}</div>
      <aside class="panel">
        <div class="top-row">
          <h2>혼자 하기</h2>
          <div class="mini-actions"><span class="badge">Stage ${solo.stage}</span>${soundControlHtml()}</div>
        </div>
        <p class="muted">${solo.result ? '도전 완료' : `${difficultyLabel(solo.difficulty)} AI와 대국 중`}</p>
        ${ruleNoteHtml(false)}
        ${solo.result ? resultHtml({ ...solo, players: [{ color: 'black', nickname: state.nickname }, { color: 'white', nickname: 'AI' }] }, { color: 'black', nickname: state.nickname }) : ''}
        <div class="stage-grid">${Array.from({ length: 10 }, (_, index) => `<button class="stage" data-stage="${index + 1}">${index + 1}</button>`).join('')}</div>
        <div class="actions">
          <button id="restart">다시 시작</button>
          <button class="secondary" id="leave">로비로</button>
        </div>
      </aside>
    </section>`;
  attachBoardHandlers(onSoloMove);
  document.querySelector('#leave').addEventListener('click', () => renderLobby());
  document.querySelector('#restart').addEventListener('click', () => startSolo(solo.stage, solo.difficulty));
  document.querySelectorAll('.stage').forEach((button) => button.addEventListener('click', () => startSolo(Number(button.dataset.stage), stageDifficulty(Number(button.dataset.stage)))));
  wireSoundControls();
}

function onSoloMove(row, col) {
  if (state.solo.result || state.solo.board[row][col]) return;
  try {
    state.solo.board = placeStone(state.solo.board, row, col, 'black');
    state.solo.moves.push({ color: 'black', row, col });
    sound.playStone();
    finishSoloIfNeeded();
    if (!state.solo.result) {
      const aiMove = chooseAiMove(state.solo.board, 'white', state.solo.difficulty);
      if (aiMove) {
        state.solo.board = placeStone(state.solo.board, aiMove[0], aiMove[1], 'white');
        state.solo.moves.push({ color: 'white', row: aiMove[0], col: aiMove[1] });
        setTimeout(() => sound.playStone(), 120);
      }
      finishSoloIfNeeded();
    }
    renderSolo();
  } catch {
    renderSolo();
  }
}

function finishSoloIfNeeded() {
  if (state.solo.result) return;
  const winner = getWinner(state.solo.board);
  if (winner || isBoardFull(state.solo.board)) {
    state.solo.result = {
      winnerColor: winner?.color || null,
      winnerLine: winner?.line || [],
      missionsByColor: {
        black: calculateMissions({
          board: state.solo.board,
          playerColor: 'black',
          winner: winner?.color || null,
          moveCount: state.solo.moves.length,
          previousLoserWonRematch: false
        })
      }
    };
    if (winner?.color === 'black') sound.playWin();
    else if (winner?.color === 'white') sound.playLose();
  }
}

function boardHtml(board, winnerLine, blockedCells) {
  const winning = new Set(winnerLine.map(([row, col]) => `${row}:${col}`));
  const blocked = new Set(blockedCells.map(([row, col]) => `${row}:${col}`));
  const hoshi = [
    [3, 3],
    [3, 7],
    [3, 11],
    [7, 3],
    [7, 7],
    [7, 11],
    [11, 3],
    [11, 7],
    [11, 11]
  ].map(([row, col]) => `<span class="hoshi" style="--row: ${row}; --col: ${col};"></span>`);
  const guides = [];
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = board[row][col];
      const key = `${row}:${col}`;
      guides.push(`<span class="intersection-guide" style="--row: ${row}; --col: ${col};"></span>`);
      cells.push(`
        <button class="cell ${winning.has(key) ? 'winning' : ''} ${blocked.has(key) ? 'blocked' : ''}" style="--row: ${row}; --col: ${col};" data-row="${row}" data-col="${col}">
          ${cell ? `<span class="stone ${cell}"></span>` : ''}
        </button>`);
    }
  }
  return `<div class="board">${guides.join('')}${hoshi.join('')}${cells.join('')}</div>`;
}

function attachBoardHandlers(handler) {
  document.querySelectorAll('.cell').forEach((cell) => {
    cell.addEventListener('click', async () => {
      await sound.unlock();
      handler(Number(cell.dataset.row), Number(cell.dataset.col));
    });
  });
}

function resultHtml(room, me) {
  const missions = room.result?.missionsByColor?.[me.color]?.missions || [];
  const score = room.result?.missionsByColor?.[me.color]?.score || 0;
  return `<div class="panel">
    <h3>${room.result.winnerColor === me.color ? '승리' : room.result.winnerColor ? '패배' : '무승부'} · +${score}</h3>
    <div class="missions">${missions.map((mission) => `<div class="mission">${mission.label} +${mission.points}</div>`).join('') || '<div class="mission">완료한 미션 없음</div>'}</div>
  </div>`;
}

function partyHelpHtml() {
  return `
    <span class="help-wrap">
      <button class="help-trigger" type="button" aria-label="파티룰 설명" title="파티룰 설명">?</button>
      <span class="help-popover" role="tooltip">
        <strong>파티룰</strong>
        <span>힌트: 추천 수를 볼 수 있어요.</span>
        <span>금지 칸: 매 턴 주변 한 칸이 잠시 막혀요.</span>
        <span>기본 승부는 그대로 유지하고 변수만 살짝 추가합니다.</span>
      </span>
    </span>`;
}

function partyModeSummaryHtml() {
  return `
    <div class="mode-note">
      <strong>파티룰 적용 중</strong>
      <span>힌트와 금지 칸 이벤트가 켜져 있습니다. 기본 승부는 그대로 진행돼요.</span>
    </div>`;
}

function ruleNoteHtml(partyMode) {
  return `
    <div class="mode-note rule-note">
      <strong>${partyMode ? '정통룰 + 파티 이벤트' : '정통룰'}</strong>
      <span>15x15 교차점에 착수 · 정확히 5목 승리 · 첫 수를 둔 사람이 흑</span>
    </div>`;
}

function recordHtml(name) {
  const player = state.record.players?.[name];
  if (!player) return '<div class="stat"><span>기록</span><strong>첫 대국</strong></div>';
  return `
    <div class="stat"><span>승패</span><strong>${player.wins}승 ${player.losses}패</strong></div>
    <div class="stat"><span>연승</span><strong>${player.streak} · 최고 ${player.bestStreak}</strong></div>
    <div class="stat"><span>누적 점수</span><strong>${player.score}</strong></div>`;
}

function handleOnlineAudio(room, me) {
  if (!me) return;
  if (state.lastOnlineRoomCode !== room.code) {
    state.lastOnlineRoomCode = room.code;
    state.lastOnlineMoveCount = room.moves.length;
    state.lastOnlineResultKey = resultAudioKey(room);
    state.lastOnlineStatus = room.status;
    state.lastOnlinePlayerCount = room.players.length;
    return;
  }

  const gameJustStarted =
    room.status === 'playing' &&
    room.moves.length === 0 &&
    (state.lastOnlineStatus === null || state.lastOnlineStatus === 'waiting' || state.lastOnlinePlayerCount < 2);
  if (gameJustStarted) sound.playStart();

  if (state.lastOnlineMoveCount === null) {
    state.lastOnlineMoveCount = room.moves.length;
    state.lastOnlineResultKey = resultAudioKey(room);
    state.lastOnlineStatus = room.status;
    state.lastOnlinePlayerCount = room.players.length;
    return;
  }

  if (room.moves.length < state.lastOnlineMoveCount) {
    state.lastOnlineMoveCount = room.moves.length;
    state.lastOnlineResultKey = null;
  }

  const resultKey = resultAudioKey(room);
  if (room.result && resultKey !== state.lastOnlineResultKey) {
    if (room.result.winnerColor === me.color) sound.playWin();
    else if (room.result.winnerColor) sound.playLose();
    state.lastOnlineResultKey = resultKey;
  } else if (!room.result && room.moves.length > state.lastOnlineMoveCount) {
    sound.playStone();
  }

  state.lastOnlineMoveCount = room.moves.length;
  state.lastOnlineStatus = room.status;
  state.lastOnlinePlayerCount = room.players.length;
}

function resultAudioKey(room) {
  if (!room.result) return null;
  return `${room.code}:${room.result.endedAt || room.moves.length}:${room.result.winnerColor}`;
}

async function shareRoom(room) {
  if (isLocalHost()) {
    try {
      await shareUrl({
        title: '온라인 오목',
        text: '휴대폰에서는 이 공개 링크로 열어 방을 새로 만들면 바로 대국할 수 있어요.',
        url: PUBLIC_APP_URL
      });
      renderOnline('휴대폰용 공개 링크를 공유했습니다. 휴대폰에서는 공개주소에서 방을 새로 만들면 친구가 링크 클릭만으로 입장할 수 있어요.');
    } catch {
      renderOnline('공유가 취소되었습니다.');
    }
    return;
  }

  const inviteUrl = roomInviteUrl(room.code);

  try {
    await shareUrl({
      title: '온라인 오목 대결 초대',
      text: `방 ${room.code}에서 오목 한 판 하자!`,
      url: inviteUrl
    });
    renderOnline('초대 링크를 복사/공유했습니다.');
  } catch {
    renderOnline('공유가 취소되었습니다.');
  }
}

async function shareUrl(shareData) {
  if (navigator.share) {
    await navigator.share(shareData);
    return;
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(shareData.url);
    return;
  }
  throw new Error('share is unavailable');
}

function roomInviteUrl(code) {
  const url = new URL(PUBLIC_APP_URL);
  url.searchParams.set('fresh', CACHE_BUST_PARAM);
  url.searchParams.set('room', code);
  return url.toString();
}

function cleanRuntimeUrl(params) {
  const room = normalizeRoomCode(params.get('room') || '');
  const cleanParams = new URLSearchParams();
  if (room) cleanParams.set('room', room);
  const cleanSearch = cleanParams.toString();
  const cleanPath = `${location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`;
  if (`${location.pathname}${location.search}` !== cleanPath) {
    history.replaceState(null, '', cleanPath);
  }
}

function mobileShareHtml() {
  return `
    <div class="mode-note mobile-note">
      <strong>휴대폰에서 바로 실행</strong>
      <span>친구에게는 localhost가 아니라 공개주소를 보내야 클릭 즉시 열립니다.</span>
      <div class="mobile-link-actions">
        <a class="link-button" href="${PUBLIC_APP_URL}" target="_blank" rel="noreferrer">공개 게임 열기</a>
        <button class="secondary" id="share-mobile-url" type="button">휴대폰용 링크 공유</button>
      </div>
    </div>`;
}

function wireMobileShare() {
  document.querySelector('#share-mobile-url')?.addEventListener('click', async () => {
    try {
      await shareUrl({
        title: '온라인 오목',
        text: '휴대폰에서 바로 열 수 있는 온라인 오목 링크입니다.',
        url: PUBLIC_APP_URL
      });
      renderLobby('휴대폰용 공개 링크를 복사/공유했습니다.');
    } catch {
      renderLobby('공유가 취소되었습니다.');
    }
  });
}

function normalizeRoomCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

function soundControlHtml() {
  return `<button class="sound-toggle secondary" type="button" data-sound-toggle>${sound.isMuted() ? '소리 꺼짐' : '소리 켜짐'}</button>`;
}

function wireSoundControls() {
  document.querySelectorAll('[data-sound-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const muted = sound.toggleMuted();
      button.textContent = muted ? '소리 꺼짐' : '소리 켜짐';
      if (!muted) await sound.unlock();
    });
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (isLocalHost()) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations?.().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
      globalThis.caches?.keys?.().then((keys) => {
        keys.forEach((key) => globalThis.caches.delete(key));
      }).catch(() => {});
    });
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function isLocalHost() {
  return ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
}

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청 실패');
  return data;
}

function colorLabel(color) {
  if (!color) return '첫 수=흑';
  return color === 'black' ? '흑' : '백';
}

function stageDifficulty(stage) {
  return `level-${Math.max(1, Math.min(10, Number(stage) || 1))}`;
}

function difficultyLabel(difficulty) {
  const levelMatch = String(difficulty).match(/level-(\d+)/);
  if (levelMatch) {
    const level = Number(levelMatch[1]);
    if (level >= 10) return '최고';
    if (level >= 8) return '고급';
    if (level >= 6) return '어려움';
    if (level >= 3) return '보통';
    return '입문';
  }
  if (difficulty === 'expert') return '최고';
  if (difficulty === 'hard') return '어려움';
  if (difficulty === 'normal') return '보통';
  return '쉬움';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function createSoundEngine(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const AudioContextClass = options.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
  let context = null;
  let muted = storage?.getItem(SOUND_STORAGE_KEY) === 'true';

  async function unlock() {
    if (muted || !AudioContextClass) return;
    if (!context) context = new AudioContextClass();
    if (context.state === 'suspended') await context.resume();
  }

  function playStone() {
    if (!canPlay()) return;
    const now = context.currentTime;
    playNoise(now, 0.035, 0.16);
    playTone({ frequency: 156, start: now, duration: 0.09, type: 'triangle', peak: 0.38 });
    playTone({ frequency: 540, start: now + 0.006, duration: 0.035, type: 'square', peak: 0.06 });
  }

  function playStart() {
    if (!canPlay()) return;
    playSequence([262, 392, 523], 0.09, 0.18, 'triangle');
  }

  function playWin() {
    if (!canPlay()) return;
    playSequence([392, 523, 659, 784, 1046], 0.105, 0.22, 'triangle');
  }

  function playLose() {
    if (!canPlay()) return;
    playSequence([392, 330, 262, 196], 0.14, 0.18, 'sine');
  }

  function toggleMuted() {
    muted = !muted;
    storage?.setItem(SOUND_STORAGE_KEY, String(muted));
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function canPlay() {
    if (muted || !AudioContextClass) return false;
    if (!context) context = new AudioContextClass();
    return context.state !== 'suspended';
  }

  function playTone({ frequency, start, duration, type, peak }) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playNoise(start, duration, peak) {
    if (!context.createBufferSource) return;
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(start);
    source.stop(start + duration);
  }

  function playSequence(notes, step, peak, type) {
    const start = context.currentTime;
    notes.forEach((frequency, index) => {
      playTone({
        frequency,
        start: start + index * step,
        duration: step * 0.9,
        type,
        peak: peak * Math.max(0.5, 1 - index * 0.08)
      });
    });
  }

  return {
    unlock,
    playStone,
    playStart,
    playWin,
    playLose,
    toggleMuted,
    isMuted
  };
}

const MISSION_DEFS = {
  win: { label: '승리', points: 1000 },
  'open-four': { label: '열린 4 만들기', points: 450 },
  'fast-win': { label: '빠른 승리', points: 350 },
  revenge: { label: '복수전 승리', points: 500 }
};

function calculateMissions({ board, playerColor, winner, moveCount, previousLoserWonRematch }) {
  const missions = [];
  if (winner === playerColor) missions.push({ id: 'win', ...MISSION_DEFS.win });
  if (hasOpenFour(board, playerColor)) missions.push({ id: 'open-four', ...MISSION_DEFS['open-four'] });
  if (winner === playerColor && moveCount <= 18) missions.push({ id: 'fast-win', ...MISSION_DEFS['fast-win'] });
  if (winner === playerColor && previousLoserWonRematch) missions.push({ id: 'revenge', ...MISSION_DEFS.revenge });

  return {
    score: missions.reduce((sum, mission) => sum + mission.points, 0),
    missions
  };
}

function hasOpenFour(board, color) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      for (const [dr, dc] of directions) {
        const cells = [];
        for (let step = 0; step < 4; step += 1) cells.push([row + dr * step, col + dc * step]);
        if (!cells.every(([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE)) continue;
        if (!cells.every(([r, c]) => board[r][c] === color)) continue;

        const before = [row - dr, col - dc];
        const after = [row + dr * 4, col + dc * 4];
        if (isOpen(board, before[0], before[1]) && isOpen(board, after[0], after[1])) return true;
      }
    }
  }

  return false;
}

function updateLocalRecord(record, { playerName, opponentName, won, score }) {
  const next = JSON.parse(JSON.stringify(record || {}));
  next.players ||= {};
  next.rivals ||= {};
  next.players[playerName] ||= { wins: 0, losses: 0, score: 0, streak: 0, bestStreak: 0 };

  const player = next.players[playerName];
  player.wins += won ? 1 : 0;
  player.losses += won ? 0 : 1;
  player.score += score;
  player.streak = won ? player.streak + 1 : 0;
  player.bestStreak = Math.max(player.bestStreak, player.streak);

  const key = [playerName, opponentName].sort().join('::');
  next.rivals[key] ||= { names: [playerName, opponentName].sort(), wins: 0, losses: 0 };
  if (won) next.rivals[key].wins += 1;
  else next.rivals[key].losses += 1;

  return next;
}

function isOpen(board, row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === null;
}
