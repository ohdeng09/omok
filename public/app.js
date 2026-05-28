import { BOARD_SIZE, createBoard, getWinner, isBoardFull, placeStone } from '/src/rules.js';
import { chooseAiMove } from '/src/ai.js';
import { calculateMissions, updateLocalRecord } from '/src/scoring.js';
import { createSoundEngine } from '/sound.js';

const app = document.querySelector('#app');
const sound = createSoundEngine();
const initialParams = new URLSearchParams(location.search);
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
        ${state.pendingRoomCode ? '<p class="muted">초대 링크로 들어왔습니다. 닉네임을 넣고 방 입장을 누르세요.</p>' : ''}
        ${message ? `<p class="muted">${escapeHtml(message)}</p>` : ''}
      </form>
    </section>`;
  document.querySelector('#lobby-form').addEventListener('submit', onLobbySubmit);
  wireSoundControls();
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
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = board[row][col];
      const key = `${row}:${col}`;
      cells.push(`
        <button class="cell ${winning.has(key) ? 'winning' : ''} ${blocked.has(key) ? 'blocked' : ''}" data-row="${row}" data-col="${col}">
          ${cell ? `<span class="stone ${cell}"></span>` : ''}
        </button>`);
    }
  }
  return `<div class="board">${cells.join('')}</div>`;
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
    return;
  }

  if (state.lastOnlineMoveCount === null) {
    state.lastOnlineMoveCount = room.moves.length;
    state.lastOnlineResultKey = resultAudioKey(room);
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
}

function resultAudioKey(room) {
  if (!room.result) return null;
  return `${room.code}:${room.result.endedAt || room.moves.length}:${room.result.winnerColor}`;
}

async function shareRoom(room) {
  const inviteUrl = roomInviteUrl(room.code);
  const shareData = {
    title: '온라인 오목 대결 초대',
    text: `방 ${room.code}에서 오목 한 판 하자!`,
    url: inviteUrl
  };

  try {
    if (navigator.share) await navigator.share(shareData);
    else if (navigator.clipboard) await navigator.clipboard.writeText(inviteUrl);
    renderOnline('초대 링크를 복사/공유했습니다.');
  } catch {
    renderOnline('공유가 취소되었습니다.');
  }
}

function roomInviteUrl(code) {
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  url.hash = '';
  return url.toString();
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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
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
  return color === 'black' ? '흑' : '백';
}

function stageDifficulty(stage) {
  if (stage >= 7) return 'hard';
  if (stage >= 4) return 'normal';
  return 'easy';
}

function difficultyLabel(difficulty) {
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
