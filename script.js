/* =========================================================
   LUMIERE WORDLE – PRO ENGINE (IDENTITY & CHALLENGE V3.0)
   ========================================================= */

/* ---------------- GLOBAL STATE ---------------- */
let SOLUTIONS = [];
let VALID_GUESSES = [];
let solution = "";
let currentRow = 0;
let currentGuess = "";
let gameOver = false;
let mode = "daily";
let challengeCode = null;
let challengeCreator = ""; // Stores who created the active challenge

/* ---------------- IDENTITY STATE ---------------- */
let userName = localStorage.getItem("lumiere_username") || "";

/* ---------------- TIMER STATE ---------------- */
let gameStartTime = null;
let gameEndTime = null;
let timerInterval = null;
let elapsedTime = 0;

/* ---------------- CONSTANTS ---------------- */
const ROWS = 6;
const COLS = 5;
const SALT = 9137;
const STATE_PRIORITY = { absent: 1, present: 2, correct: 3 };
const keyStates = {};

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
   IDENTITY MANAGEMENT
   ========================================================= */
function checkUserIdentity() {
    if (!userName) {
        const name = prompt("Welcome to Lumiere Wordle! Please enter your name for challenges:");
        if (name && name.trim()) {
            userName = name.trim();
            localStorage.setItem("lumiere_username", userName);
            showStatus(`Signed in as ${userName}`);
        } else {
            userName = "Anonymous";
        }
    }
}

/* =========================================================
   CORE UTILITIES (LOADER/TIMER)
   ========================================================= */
async function loadWordFile(path) {
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("Load failed");
        const text = await res.text();
        return text.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => /^[a-z]{5}$/.test(w));
    } catch (e) { return []; }
}

async function loadWords() {
    SOLUTIONS = await loadWordFile("solutions.txt");
    VALID_GUESSES = await loadWordFile("guesses.txt");
    SOLUTIONS.forEach(w => { if (!VALID_GUESSES.includes(w)) VALID_GUESSES.push(w); });
}

function startTimer() {
    if (gameStartTime) return;
    gameStartTime = Date.now();
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const min = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const sec = (elapsedTime % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${min}:${sec}`;
}

/* =========================================================
   INIT
   ========================================================= */
(async function init() {
    checkUserIdentity();
    await loadWords();
    initBoard();
    initKeyboard();
    bindUI();
    startDaily();
})();

/* =========================================================
   UI & INPUT
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
    const layout = [
        ["Q","W","E","R","T","Y","U","I","O","P"],
        ["A","S","D","F","G","H","J","K","L"],
        ["ENTER","Z","X","C","V","B","N","M","⌫"]
    ];
    keyboard.innerHTML = "";
    layout.forEach(row => {
        const div = document.createElement("div");
        row.forEach(lbl => {
            const key = document.createElement("div");
            key.className = "key" + (lbl.length > 1 ? " wide" : "");
            key.textContent = lbl;
            if (lbl.length === 1 && lbl !== "⌫") key.dataset.key = lbl.toLowerCase();
            key.onclick = () => handleKey(lbl);
            div.appendChild(key);
        });
        keyboard.appendChild(div);
    });
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
    [...row.children].forEach((tile, i) => tile.textContent = currentGuess[i] || "");
}

/* =========================================================
   GAME ENGINE
   ========================================================= */
function startDaily() {
    mode = "daily";
    challengeCode = null;
    challengeCreator = "";
    startGame(getDailyWord());
}

function startGame(word) {
    modal.classList.add("hidden");
    solution = word;
    currentRow = 0;
    currentGuess = "";
    gameOver = false;
    gameStartTime = null;
    elapsedTime = 0;
    clearInterval(timerInterval);
    updateTimerDisplay();

    for (const k in keyStates) delete keyStates[k];
    document.querySelectorAll(".key").forEach(k => k.classList.remove("absent", "present", "correct"));
    initBoard();
}

function submitGuess() {
    const row = board.children[currentRow];
    if (currentGuess.length !== COLS) return;
    if (!VALID_GUESSES.includes(currentGuess)) {
        row.classList.add("shake");
        setTimeout(() => row.classList.remove("shake"), 500);
        return;
    }

    if (currentRow === 0) startTimer();

    const result = scoreGuess(currentGuess, solution);
    const guessToProcess = currentGuess;
    gameOver = true;

    result.forEach((res, i) => {
        const tile = row.children[i];
        setTimeout(() => {
            tile.classList.add("flip");
            setTimeout(() => {
                tile.classList.add(res);
                tile.textContent = guessToProcess[i];
                updateKeyboard(guessToProcess[i], res);
                if (i === COLS - 1) checkGameState(guessToProcess);
            }, 250);
        }, i * 300);
    });
    currentGuess = "";
}

function checkGameState(guess) {
    if (guess === solution) {
        clearInterval(timerInterval);
        setTimeout(() => endGame(true), 500);
    } else if (++currentRow === ROWS) {
        clearInterval(timerInterval);
        setTimeout(() => endGame(false), 500);
    } else {
        gameOver = false;
    }
}

function scoreGuess(guess, sol) {
    const res = Array(COLS).fill("absent");
    const solArr = sol.split("");
    for (let i = 0; i < COLS; i++) {
        if (guess[i] === sol[i]) { res[i] = "correct"; solArr[i] = null; }
    }
    for (let i = 0; i < COLS; i++) {
        if (res[i] === "correct") continue;
        const idx = solArr.indexOf(guess[i]);
        if (idx !== -1) { res[i] = "present"; solArr[idx] = null; }
    }
    return res;
}

function updateKeyboard(letter, state) {
    const key = document.querySelector(`.key[data-key="${letter}"]`);
    if (!key) return;
    const old = keyStates[letter];
    if (!old || STATE_PRIORITY[state] > STATE_PRIORITY[old]) {
        keyStates[letter] = state;
        key.classList.remove("absent", "present", "correct");
        key.classList.add(state);
    }
}

/* =========================================================
   END GAME & RESULTS
   ========================================================= */
function endGame(win) {
    gameOver = true;
    showResults(win);
}

function showResults(win) {
    copyResultBtn.textContent = "Copy";
    const timeStr = timerDisplay.textContent;
    
    // Header Logic
    let displayTitle = win ? `Solved in ${timeStr}!` : `Failed! Word: ${solution.toUpperCase()}`;
    if (challengeCreator && challengeCreator !== "Anonymous") {
        displayTitle = `${win ? "Puzzle Cracked!" : "Annie Won!"}\nOriginal by: ${challengeCreator}`;
    }
    resultTitle.innerText = displayTitle;

    // Grid Logic
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

    let resultText = `LUMIERE WORDLE\n`;
    if (mode === "challenge") {
        resultText += `Puzzle by: ${challengeCreator || "Anonymous"}\n`;
    } else {
        resultText += `Daily Mode\n`;
    }
    resultText += `${win ? "Solved" : "Failed"} in ${timeStr}\n\n${grid}`;
    
    resultGrid.textContent = resultText;
    modal.classList.remove("hidden");
}

/* =========================================================
   CHALLENGE SYSTEM (MODIFIED FOR IDENTITY)
   ========================================================= */
function createChallenge() {
    const word = prompt("Enter a 5-letter word for the challenge:")?.toLowerCase();
    if (!word || !VALID_GUESSES.includes(word)) {
        showStatus("Invalid Word");
        return;
    }
    const code = encodeWord(word);
    const shareText = `🧩 LUMIERE WORDLE CHALLENGE\nCreated by: ${userName}\nCode: \`${code}\`\nPlay: https://aioch13.github.io/wordle/`;
    
    navigator.clipboard.writeText(shareText).then(() => {
        showStatus("Invite with your name copied!");
    });
}

function loadChallenge(input) {
    // Extract Name
    const nameMatch = input.match(/Created by:\s*([^\n\r]+)/i);
    challengeCreator = nameMatch ? nameMatch[1].trim() : "Anonymous";

    // Extract Code
    const match = input.match(/`([^`]+)`/) || input.match(/[A-Za-z0-9+/]{4,}/);
    const code = match ? (match[1] || match[0]).trim() : null;
    const word = code ? decodeWord(code) : null;

    if (word) {
        mode = "challenge";
        challengeCode = code;
        startGame(word);
        showStatus(`Challenge by ${challengeCreator} started!`);
    } else {
        showStatus("Invalid Code");
    }
}

/* ---------------- HELPERS ---------------- */
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
    } catch { return null; }
}

function getDailyWord() {
    const start = new Date("2021-06-19");
    const index = Math.floor((new Date() - start) / 86400000);
    return SOLUTIONS[index % SOLUTIONS.length];
}

function bindUI() {
    dailyBtn.onclick = startDaily;
    challengeBtn.onclick = () => challengePanel.classList.toggle("hidden");
    loadChallengeBtn.onclick = () => loadChallenge(challengeInput.value.trim());
    createChallengeBtn.onclick = createChallenge;
    pasteChallengeBtn.onclick = () => {
        navigator.clipboard.readText().then(t => {
            challengeInput.value = t;
            loadChallenge(t);
        });
    };
    copyResultBtn.onclick = () => {
        navigator.clipboard.writeText(resultGrid.textContent);
        showStatus("Results Copied!");
    };
    document.getElementById("playAgain").onclick = startDaily;
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
}

function showStatus(msg) {
    statusBar.textContent = msg;
    statusBar.classList.remove("hidden");
    setTimeout(() => statusBar.classList.add("hidden"), 2000);
}
