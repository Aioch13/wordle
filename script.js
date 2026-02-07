/* =========================================================
   WORDLE CHALLENGE – CORE ENGINE (PATCHED)
   ========================================================= */

/* ---------------- GLOBAL WORD LISTS ---------------- */
let SOLUTIONS = [];
let VALID_GUESSES = [];

/* ---------------- GAME STATE ---------------- */
let solution = "";
let currentRow = 0;
let currentGuess = "";
let gameOver = false;
let mode = "daily";
let challengeCode = null;

/* ---------------- KEYBOARD STATE ---------------- */
const keyStates = {};
const STATE_PRIORITY = { absent: 1, present: 2, correct: 3 };

/* ---------------- CONSTANTS ---------------- */
const ROWS = 6;
const COLS = 5;
const SALT = 9137;

/* ---------------- DOM ---------------- */
const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const dailyBtn = document.getElementById("dailyBtn");
const challengeBtn = document.getElementById("challengeBtn");
const challengePanel = document.getElementById("challengePanel");
const challengeInput = document.getElementById("challengeInput");
const loadChallengeBtn = document.getElementById("loadChallenge");
const createChallengeBtn = document.getElementById("createChallenge");
const pasteChallengeBtn = document.getElementById("pasteChallenge");
const modal = document.getElementById("modal");
const resultTitle = document.getElementById("resultTitle");
const resultGrid = document.getElementById("resultGrid");
const copyResultBtn = document.getElementById("copyResult");
const statusBar = document.getElementById("status");

/* =========================================================
   STATUS MESSAGE
   ========================================================= */
function showStatus(msg, timeout = 2000) {
  statusBar.textContent = msg;
  statusBar.classList.remove("hidden");

  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    statusBar.classList.add("hidden");
  }, timeout);
}

/* =========================================================
   LOAD WORD LISTS
   ========================================================= */
async function loadWordFile(path) {
  const res = await fetch(path);
  const text = await res.text();
  return text
    .split(/\r?\n/)
    .map(w => w.trim().toLowerCase())
    .filter(w => /^[a-z]{5}$/.test(w));
}

async function loadWords() {
  SOLUTIONS = await loadWordFile("solutions.txt");
  VALID_GUESSES = await loadWordFile("guesses.txt");
  SOLUTIONS.forEach(w => {
    if (!VALID_GUESSES.includes(w)) VALID_GUESSES.push(w);
  });
}

/* =========================================================
   INIT
   ========================================================= */
(async function init() {
  await loadWords();
  initBoard();
  initKeyboard();
  bindUI();
  startDaily();
})();

/* =========================================================
   UI SETUP
   ========================================================= */
function initBoard() {
  board.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function initKeyboard() {
  const keyboardLayout = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["⌫","Z","X","C","V","B","N","M","ENTER"]
  ];

  keyboard.innerHTML = "";

  keyboardLayout.forEach(row => {
    const rowDiv = document.createElement("div");

    row.forEach(keyLabel => {
      const key = makeKey(keyLabel);

      if (keyLabel === "ENTER" || keyLabel === "⌫") {
        key.classList.add("wide");
      }

      rowDiv.appendChild(key);
    });

    keyboard.appendChild(rowDiv);
  });
}


function makeKey(label) {
  const key = document.createElement("div");
  key.className = "key";
  key.textContent = label;
  if (label.length === 1) key.dataset.key = label.toLowerCase();
  key.onclick = () => handleKey(label);
  return key;
}

function bindUI() {
  document.addEventListener("keydown", e => {
    if (gameOver) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter") handleKey("ENTER");
    else if (e.key === "Backspace") handleKey("⌫");
    else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
  });

  // Modal "Click Outside to Close" Logic
  modal.onclick = e => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  };

  dailyBtn.onclick = startDaily;
  challengeBtn.onclick = () => challengePanel.classList.toggle("hidden");
  loadChallengeBtn.onclick = () => loadChallenge(challengeInput.value.trim());
  createChallengeBtn.onclick = createChallenge;
  pasteChallengeBtn.onclick = pasteChallenge;
  copyResultBtn.onclick = copyResults;
}
/* =========================================================
   GAME START
   ========================================================= */
function startDaily() {
  mode = "daily";
  challengeCode = null;
  startGame(getDailyWord());
}

function startGame(word) {
  solution = word;
  currentRow = 0;
  currentGuess = "";
  gameOver = false;
  modal.classList.add("hidden");

  for (const k in keyStates) delete keyStates[k];
  document.querySelectorAll(".key").forEach(k =>
    k.classList.remove("absent", "present", "correct")
  );

  initBoard();
}

/* =========================================================
   DAILY WORD
   ========================================================= */
function getDailyWord() {
  const start = new Date("2021-06-19");
  const today = new Date();
  const index = Math.floor((today - start) / 86400000);
  return SOLUTIONS[index % SOLUTIONS.length];
}

/* =========================================================
   INPUT HANDLING
   ========================================================= */
function handleKey(key) {
  if (gameOver) return;

  if (key === "ENTER") submitGuess();
  else if (key === "⌫") currentGuess = currentGuess.slice(0, -1);
  else if (currentGuess.length < COLS) currentGuess += key.toLowerCase();

  renderRow();
}

function renderRow() {
  const row = board.children[currentRow];
  [...row.children].forEach((tile, i) => {
    tile.textContent = currentGuess[i] || "";
  });
}

/* =========================================================
   GUESS SUBMISSION
   ========================================================= */
function submitGuess() {
  if (currentGuess.length !== COLS) return;
  if (!VALID_GUESSES.includes(currentGuess)) {
    showStatus("Not in word list");
    return;
  }

  const result = scoreGuess(currentGuess, solution);
  const row = board.children[currentRow];

  result.forEach((res, i) => row.children[i].classList.add(res));
  updateKeyboard(currentGuess, result);

  if (currentGuess === solution) endGame(true);
  else if (++currentRow === ROWS) endGame(false);

  currentGuess = "";
}

/* =========================================================
   SCORING
   ========================================================= */
function scoreGuess(guess, sol) {
  const res = Array(COLS).fill("absent");
  const solArr = sol.split("");

  for (let i = 0; i < COLS; i++) {
    if (guess[i] === sol[i]) {
      res[i] = "correct";
      solArr[i] = null;
    }
  }

  for (let i = 0; i < COLS; i++) {
    if (res[i] === "correct") continue;
    const idx = solArr.indexOf(guess[i]);
    if (idx !== -1) {
      res[i] = "present";
      solArr[idx] = null;
    }
  }
  return res;
}

/* =========================================================
   KEYBOARD UPDATE
   ========================================================= */
function updateKeyboard(guess, result) {
  for (let i = 0; i < COLS; i++) {
    const letter = guess[i];
    const newState = result[i];
    const oldState = keyStates[letter];

    if (!oldState || STATE_PRIORITY[newState] > STATE_PRIORITY[oldState]) {
      keyStates[letter] = newState;
      const keyEl = document.querySelector(`.key[data-key="${letter}"]`);
      if (keyEl) {
        keyEl.classList.remove("absent", "present", "correct");
        keyEl.classList.add(newState);
      }
    }
  }
}

/* =========================================================
   END GAME
   ========================================================= */
function endGame(win) {
  gameOver = true;
  showResults(win);
}

function showResults(win) {
  resultTitle.textContent = win
    ? `Solved ${currentRow + 1}/${ROWS}`
    : `Failed – Word was hidden`;

  let grid = "";
  for (let r = 0; r <= currentRow; r++) {
    const row = board.children[r];
    [...row.children].forEach(tile => {
      grid += tile.classList.contains("correct")
        ? "🟩"
        : tile.classList.contains("present")
        ? "🟨"
        : "⬜";
    });
    grid += "\n";
  }

  resultGrid.textContent =
    (mode === "challenge" ? `Challenge ${challengeCode}\n\n` : "") + grid;

  modal.classList.remove("hidden");
}

function copyResults() {
  navigator.clipboard.writeText(resultGrid.textContent);
}

/* =========================================================
   CHALLENGE MODE
   ========================================================= */
function createChallenge() {
  const word = prompt("Enter a 5-letter word")?.toLowerCase();
  if (!word || !VALID_GUESSES.includes(word)) {
    showStatus("Invalid word");
    return;
  }

  const code = encodeWord(word);
  navigator.clipboard.writeText(code);
  showStatus("Challenge generated & copied");
}

function pasteChallenge() {
  navigator.clipboard.readText().then(text => {
    challengeInput.value = text.trim();
    showStatus("Challenge code pasted");
  });
}

function loadChallenge(code) {
  const word = decodeWord(code);
  if (!word || !VALID_GUESSES.includes(word)) {
    showStatus("Invalid challenge code");
    return;
  }

  mode = "challenge";
  challengeCode = code;
  startGame(word);
  showStatus("Challenge started");
}

function encodeWord(word) {
  let num = 0;
  for (let c of word) num = num * 26 + (c.charCodeAt(0) - 97);
  num ^= SALT;
  return btoa(num.toString()).replace(/=/g, "");
}

function decodeWord(code) {
  try {
    let num = parseInt(atob(code));
    num ^= SALT;
    let letters = [];
    for (let i = 0; i < COLS; i++) {
      letters.unshift(String.fromCharCode(97 + (num % 26)));
      num = Math.floor(num / 26);
    }
    return letters.join("");
  } catch {
    return null;
  }
}
