// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
let puzzle = [];
let timerInterval = null;
let timerStart = null;
let elapsedSeconds = 0;
let timerRunning = false;
let timerPaused = false;
let hintsUsed = 0;

const LEADERBOARD_KEY = 'sudoku-leaderboard';

const DIFFICULTY_CLUES = {
  easy: 40,
  medium: 32,
  hard: 24,
};

const THEME_KEY = 'sudoku-theme';

function getBoardInputs() {
  return document.getElementById('sudoku-board').getElementsByTagName('input');
}

function getBoardValues() {
  const inputs = getBoardInputs();
  const board = [];
  for (let row = 0; row < SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < SIZE; col++) {
      const idx = row * SIZE + col;
      const value = inputs[idx].value;
      board[row][col] = value ? parseInt(value, 10) : 0;
    }
  }
  return board;
}

function getSelectedDifficultyLabel() {
  const difficultySelect = document.getElementById('difficulty');
  const selectedOption = difficultySelect.options[difficultySelect.selectedIndex];
  return selectedOption ? selectedOption.text : 'Easy';
}

function getCellBaseClass(row, col) {
  const blockClass = (Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 0 ? 'block-even' : 'block-odd';
  const dividerClasses = [];

  if (col === 2 || col === 5) {
    dividerClasses.push('divider-right');
  }
  if (row === 2 || row === 5) {
    dividerClasses.push('divider-bottom');
  }

  return `sudoku-cell ${blockClass} ${dividerClasses.join(' ')}`.trim();
}

function getStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  return storedTheme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);

  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.innerText = theme === 'dark' ? '🌙' : '🌞';
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

function getPlayerName() {
  const playerInput = document.getElementById('player-name');
  const playerName = playerInput.value.trim();
  return playerName || 'Player';
}

function getCompletionSummary() {
  return {
    name: getPlayerName(),
    difficulty: getSelectedDifficultyLabel(),
    time: formatTime(elapsedSeconds),
    hintsUsed,
    seconds: elapsedSeconds,
  };
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

function renderLeaderboard() {
  const body = document.getElementById('leaderboard-body');
  const entries = loadLeaderboard();
  body.innerHTML = '';

  if (entries.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.innerText = 'No completed games yet.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  entries.forEach((entry, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.name}</td>
      <td>${entry.difficulty}</td>
      <td>${entry.time}</td>
      <td>${entry.hintsUsed}</td>
    `;
    body.appendChild(row);
  });
}

function addLeaderboardEntry(entry) {
  const entries = loadLeaderboard();
  entries.push(entry);
  entries.sort((left, right) => left.seconds - right.seconds);
  saveLeaderboard(entries.slice(0, 10));
  renderLeaderboard();
}

function isValueValid(board, row, col) {
  const value = board[row][col];
  if (value === 0) {
    return true;
  }

  for (let index = 0; index < SIZE; index++) {
    if (index !== col && board[row][index] === value) {
      return false;
    }
    if (index !== row && board[index][col] === value) {
      return false;
    }
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 3; r++) {
    for (let c = startCol; c < startCol + 3; c++) {
      if ((r !== row || c !== col) && board[r][c] === value) {
        return false;
      }
    }
  }

  return true;
}

function refreshValidationState() {
  const board = getBoardValues();
  const inputs = getBoardInputs();

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const idx = row * SIZE + col;
      const input = inputs[idx];

      if (input.disabled) {
        input.className = `${getCellBaseClass(row, col)} prefilled`;
        continue;
      }

      const isInvalid = board[row][col] !== 0 && !isValueValid(board, row, col);
      input.className = isInvalid
        ? `${getCellBaseClass(row, col)} red`
        : `${getCellBaseClass(row, col)} normal`;
    }
  }
}

function applyHintToBoard(row, col, value) {
  const inputs = getBoardInputs();
  const idx = row * SIZE + col;
  const input = inputs[idx];
  input.value = value;
  input.disabled = true;
  hintsUsed += 1;
  refreshValidationState();
}

function showCompletionPopup(completionTime) {
  const popup = document.getElementById('completion-popup');
  const timeElement = document.getElementById('completion-time');
  const difficultyElement = document.getElementById('completion-difficulty');
  const playerElement = document.getElementById('completion-player');

  timeElement.innerText = completionTime;
  difficultyElement.innerText = getSelectedDifficultyLabel();
  playerElement.innerText = getPlayerName();
  popup.classList.remove('hidden');
  popup.setAttribute('aria-hidden', 'false');
}

function hideCompletionPopup() {
  const popup = document.getElementById('completion-popup');
  popup.classList.add('hidden');
  popup.setAttribute('aria-hidden', 'true');
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerDisplay(totalSeconds) {
  document.getElementById('timer-display').innerText = formatTime(totalSeconds);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimerInterval();
  timerStart = Date.now() - (elapsedSeconds * 1000);
  timerRunning = true;
  timerPaused = false;
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - timerStart) / 1000);
    updateTimerDisplay(elapsedSeconds);
  }, 1000);
  updateTimerDisplay(elapsedSeconds);
}

function pauseTimer() {
  if (!timerRunning) {
    return;
  }
  elapsedSeconds = Math.floor((Date.now() - timerStart) / 1000);
  stopTimerInterval();
  timerRunning = false;
  timerPaused = true;
  updateTimerDisplay(elapsedSeconds);
}

function stopTimer() {
  if (timerRunning) {
    elapsedSeconds = Math.floor((Date.now() - timerStart) / 1000);
  }
  stopTimerInterval();
  timerRunning = false;
  timerPaused = false;
  updateTimerDisplay(elapsedSeconds);
  return elapsedSeconds;
}

async function storeCompletionTime() {
  const completionTime = formatTime(elapsedSeconds);
  await fetch('/complete', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({completion_time: completionTime})
  });
  return completionTime;
}

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = getCellBaseClass(i, j);
      input.dataset.row = i;
      input.dataset.col = j;
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^1-9]/g, '');
        e.target.value = val;
        refreshValidationState();
      });
      boardDiv.appendChild(input);
    }
  }
}

function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.disabled = true;
        inp.className = `${getCellBaseClass(i, j)} prefilled`;
      } else {
        inp.value = '';
        inp.disabled = false;
      }
    }
  }
  refreshValidationState();
}

async function newGame() {
  stopTimerInterval();
  elapsedSeconds = 0;
  timerStart = null;
  timerRunning = false;
  timerPaused = false;
  hintsUsed = 0;
  hideCompletionPopup();
  const difficultySelect = document.getElementById('difficulty');
  const clues = parseInt(difficultySelect.value, 10) || DIFFICULTY_CLUES.easy;
  const res = await fetch(`/new?clues=${clues}`);
  const data = await res.json();
  renderPuzzle(data.puzzle);
  document.getElementById('message').innerText = '';
  updateTimerDisplay(0);
  startTimer();
}

async function requestHint() {
  const res = await fetch('/hint', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({})
  });
  const data = await res.json();
  const msg = document.getElementById('message');

  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }

  applyHintToBoard(data.row, data.col, data.value);
  msg.style.color = '#333';
  msg.innerText = 'One cell filled.';
}

async function checkSolution() {
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  const board = getBoardValues();
  const res = await fetch('/check', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({board})
  });
  const data = await res.json();
  const msg = document.getElementById('message');
  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }
  const incorrect = new Set(data.incorrect.map(x => x[0]*SIZE + x[1]));
  for (let idx = 0; idx < inputs.length; idx++) {
    const inp = inputs[idx];
    const row = parseInt(inp.dataset.row, 10);
    const col = parseInt(inp.dataset.col, 10);
    if (inp.disabled) continue;
    if (incorrect.has(idx)) {
      inp.className = `${getCellBaseClass(row, col)} compare-wrong`;
    }
  }
  if (incorrect.size === 0) {
    pauseTimer();
    const completionTime = await storeCompletionTime();
      addLeaderboardEntry({
        ...getCompletionSummary(),
        time: completionTime,
      });
    msg.style.color = '#388e3c';
    msg.innerText = `Congratulations! You solved it in ${completionTime}.`;
    showCompletionPopup(completionTime);
  } else {
    msg.style.color = '#d32f2f';
    msg.innerText = 'Some cells are incorrect.';
  }
}

async function stopGame() {
  const completionSeconds = stopTimer();
  const completionTime = formatTime(completionSeconds);
  await fetch('/complete', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({completion_time: completionTime})
  });
  const msg = document.getElementById('message');
  msg.style.color = '#333';
  msg.innerText = `Stopped at ${completionTime}.`;
}

window.addEventListener('load', () => {
  applyTheme(getStoredTheme());
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('hint-cell').addEventListener('click', requestHint);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('pause-timer').addEventListener('click', pauseTimer);
  document.getElementById('stop-timer').addEventListener('click', stopGame);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('close-completion-popup').addEventListener('click', hideCompletionPopup);
  renderLeaderboard();
  newGame();
});