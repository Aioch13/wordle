/* =========================================================
   LUMIERE WORDLE – PRO ENGINE (FINAL VERSION)
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

/* ---------------- TIMER STATE ---------------- */
let gameStartTime = null;
let gameEndTime = null;
let timerInterval = null;
let elapsedTime = 0;

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
const timerDisplay = document.getElementById("timerDisplay");

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
/* =========================================================
   LOAD WORD LISTS (WITH DEBUGGING)
   ========================================================= */
async function loadWordFile(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const words = text
      .split(/\r?\n/)
      .map(w => w.trim().toLowerCase())
      .filter(w => /^[a-z]{5}$/.test(w));
    
    console.log(`Loaded ${words.length} words from ${path}`);
    return words;
  } catch (error) {
    console.error(`Error loading ${path}:`, error);
    return [];
  }
}

async function loadWords() {
  SOLUTIONS = await loadWordFile("solutions.txt");
  VALID_GUESSES = await loadWordFile("guesses.txt");
  
  console.log(`Solutions count: ${SOLUTIONS.length}`);
  console.log(`Guesses count before merge: ${VALID_GUESSES.length}`);
  
  // Merge solutions into guesses if not already present
  SOLUTIONS.forEach(w => {
    if (!VALID_GUESSES.includes(w)) {
      VALID_GUESSES.push(w);
    }
  });
  
  console.log(`Guesses count after merge: ${VALID_GUESSES.length}`);
  
  // Test if "squid" is in the lists
  console.log(`Is "squid" in solutions? ${SOLUTIONS.includes('squid')}`);
  console.log(`Is "squid" in valid guesses? ${VALID_GUESSES.includes('squid')}`);
}

async function loadWords() {
    try {
        SOLUTIONS = await loadWordFile("solutions.txt");
        VALID_GUESSES = await loadWordFile("guesses.txt");
        SOLUTIONS.forEach(w => {
            if (!VALID_GUESSES.includes(w)) VALID_GUESSES.push(w);
        });
    } catch (e) {
        showStatus("Error loading word files");
    }
}

/* =========================================================
   TIMER FUNCTIONS
   ========================================================= */
function startTimer() {
    if (gameStartTime) return;
    gameStartTime = Date.now();
    elapsedTime = 0;
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (gameStartTime) {
        gameEndTime = Date.now();
        elapsedTime = Math.floor((gameEndTime - gameStartTime) / 1000);
    }
}

function resetTimer() {
    stopTimer();
    gameStartTime = null;
    gameEndTime = null;
    elapsedTime = 0;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    if (!timerDisplay) return;
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
        ["ENTER","Z","X","C","V","B","N","M","⌫"]
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
    if (label.length === 1 && label !== "⌫") {
        key.dataset.key = label.toLowerCase();
    }
    key.onclick = () => handleKey(label);
    return key;
}

function bindUI() {
    document.addEventListener("keydown", e => {
        if (gameOver) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") return;
        if (e.key === "Enter") handleKey("ENTER");
        else if (e.key === "Backspace") handleKey("⌫");
        else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    });

    modal.onclick = e => {
        if (e.target === modal) modal.classList.add("hidden");
    };

    dailyBtn.onclick = startDaily;
    challengeBtn.onclick = () => challengePanel.classList.toggle("hidden");
    loadChallengeBtn.onclick = () => loadChallenge(challengeInput.value.trim());
    createChallengeBtn.onclick = createChallenge;
    pasteChallengeBtn.onclick = pasteChallenge;
    copyResultBtn.onclick = copyResults;
    challengeInput.addEventListener('input', validateChallengeInput);
    document.getElementById("playAgain").onclick = () => {
        modal.classList.add("hidden");
        startDaily();
    };
}

/* =========================================================
   GAME ENGINE
   ========================================================= */
function startDaily() {
    mode = "daily";
    challengeCode = null;
    startGame(getDailyWord());
}

function startGame(word) {
    modal.classList.add("hidden"); 
    solution = word;
    currentRow = 0;
    currentGuess = "";
    gameOver = false;
    resetTimer();

    for (const k in keyStates) delete keyStates[k];
    document.querySelectorAll(".key").forEach(key => {
        key.classList.remove("absent", "present", "correct");
        key.style.background = "";
    });
    initBoard();
}

function getDailyWord() {
    const start = new Date("2021-06-19");
    const today = new Date();
    const index = Math.floor((today - start) / 86400000);
    return SOLUTIONS[index % SOLUTIONS.length];
}

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

function submitGuess() {
    const row = board.children[currentRow];
    if (currentGuess.length !== COLS) {
        showStatus("Not enough letters");
        return;
    }
    if (!VALID_GUESSES.includes(currentGuess)) {
        showStatus("Not in word list");
        row.classList.add("shake");
        setTimeout(() => row.classList.remove("shake"), 500);
        return;
    }

    if (currentRow === 0 && !gameStartTime) startTimer();

    const result = scoreGuess(currentGuess, solution);
    const guessToProcess = currentGuess;
    gameOver = true;

    result.forEach((res, i) => {
        const tile = row.children[i];
        const letter = guessToProcess[i];
        setTimeout(() => {
            tile.classList.add("flip");
            setTimeout(() => {
                tile.classList.add(res);
                tile.textContent = letter;
                updateKeyboardForLetter(letter, res);
                if (i === COLS - 1) checkGameState(guessToProcess);
            }, 250);
        }, i * 300);
    });
    currentGuess = "";
}

function checkGameState(guess) {
    if (guess === solution) {
        setTimeout(() => endGame(true), 500);
    } else if (currentRow + 1 === ROWS) {
        setTimeout(() => endGame(false), 500);
    } else {
        currentRow++;
        gameOver = false;
    }
}

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

function updateKeyboardForLetter(letter, state) {
    const keyEl = document.querySelector(`.key[data-key="${letter}"]`);
    if (!keyEl) return;
    const oldState = keyStates[letter];
    if (!oldState || STATE_PRIORITY[state] > STATE_PRIORITY[oldState]) {
        keyStates[letter] = state;
        keyEl.classList.remove("absent", "present", "correct");
        keyEl.classList.add(state);
    }
}

/* =========================================================
   END GAME
   ========================================================= */
function endGame(win) {
    gameOver = true;
    stopTimer();
    showResults(win);
}

function showResults(win) {
    copyResultBtn.textContent = "Copy";
    copyResultBtn.style.background = "";
    const timeString = formatTime(elapsedTime);
    
    resultTitle.textContent = win
        ? `Solved in ${timeString} • ${currentRow + 1}/${ROWS}`
        : `Failed in ${timeString} • Word: ${solution.toUpperCase()}`;

    let grid = "";
    for (let r = 0; r <= currentRow; r++) {
        const row = board.children[r];
        [...row.children].forEach(tile => {
            if (tile.classList.contains("correct")) grid += "🟩";
            else if (tile.classList.contains("present")) grid += "🟨";
            else grid += "⬜";
        });
        grid += "\n";
    }
    
    let resultText = (mode === "challenge" ? `Lumiere Challenge ${challengeCode}\n` : `Lumiere Daily\n`);
    resultText += `${win ? "Solved" : "Failed"} in ${timeString} • ${currentRow + 1}/${ROWS}\n\n${grid}`;
    
    resultGrid.textContent = resultText;
    modal.classList.remove("hidden");
}

function copyResults() {
    navigator.clipboard.writeText(resultGrid.textContent).then(() => {
        copyResultBtn.textContent = "✓ Copied!";
        copyResultBtn.style.background = "#2d7a28";
        setTimeout(() => {
            copyResultBtn.textContent = "Copy";
            copyResultBtn.style.background = "";
        }, 2000);
    });
}

/* =========================================================
   CHALLENGE MODE LOGIC
   ========================================================= */
function encodeWord(word) {
    let num = 0;
    for (let c of word) num = num * 26 + (c.charCodeAt(0) - 97);
    num ^= SALT;
    return btoa(num.toString()).replace(/=/g, "");
}

function decodeWord(code) {
    try {
        if (!/^[A-Za-z0-9+/=]+$/.test(code)) return null;
        let num = parseInt(atob(code));
        if (isNaN(num)) return null;
        num ^= SALT;
        let letters = [];
        for (let i = 0; i < COLS; i++) {
            letters.unshift(String.fromCharCode(97 + (num % 26)));
            num = Math.floor(num / 26);
        }
        return letters.join("");
    } catch { return null; }
}

function extractChallengeCode(text) {
    if (!text) return null;
    const match = text.match(/`([^`]+)`/) || text.match(/[A-Za-z0-9+/]{4,}/);
    if (match) {
        const code = (match[1] || match[0]).trim();
        return isValidChallengeCode(code) ? code : null;
    }
    return null;
}

function isValidChallengeCode(code) {
    const word = decodeWord(code);
    return word && word.length === 5 && VALID_GUESSES.includes(word);
}

function validateChallengeInput() {
    const code = extractChallengeCode(challengeInput.value.trim());
    if (code) {
        challengeInput.classList.add("valid");
        challengeInput.classList.remove("invalid");
    } else {
        challengeInput.classList.add("invalid");
        challengeInput.classList.remove("valid");
    }
}

function createChallenge() {
    const word = prompt("Enter a 5-letter word:")?.toLowerCase();
    if (!word || !VALID_GUESSES.includes(word)) {
        showStatus("Invalid dictionary word");
        return;
    }
    const code = encodeWord(word);
    navigator.clipboard.writeText(`🧩 LUMIERE WORDLE CHALLENGE\nCode: \`${code}\`\nhttps://aioch13.github.io/wordle/`);
    showStatus("Challenge copied to clipboard!");
}

function loadChallenge(input) {
    const code = extractChallengeCode(input);
    const word = code ? decodeWord(code) : null;
    if (word) {
        mode = "challenge";
        challengeCode = code;
        startGame(word);
        showStatus("Challenge started!");
    } else showStatus("Invalid challenge code");
}

function pasteChallenge() {
    navigator.clipboard.readText().then(text => {
        challengeInput.value = text;
        validateChallengeInput();
    });
}
