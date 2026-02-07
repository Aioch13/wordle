/* =========================================================
   LUMIERE WORDLE – PRO ENGINE (STABLE V3.2)
   NYT Light Theme & Identity Optimized
   ========================================================= */

/* ---------------- GLOBAL STATE ---------------- */
let SOLUTIONS = [];
let VALID_GUESSES = [];
let solution = "";
let currentRow = 0;
let currentGuess = "";
let gameOver = false;
let mode = "daily";
let challengeCreator = "";

/* ---------------- IDENTITY & TIMER ---------------- */
let userName = localStorage.getItem("lumiere_username") || "";
let gameStartTime = null;
let timerInterval = null;
let elapsedTime = 0;

/* ---------------- CONSTANTS ---------------- */
const ROWS = 6;
const COLS = 5;
const SALT = 9137;
const STATE_PRIORITY = { absent: 1, present: 2, correct: 3 };
const keyStates = {};

/* ---------------- DOM ELEMENTS ---------------- */
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
   1. INITIALIZATION (THE "SQUID" FIX)
   ========================================================= */
async function loadWordFile(path) {
    try {
        const res = await fetch(path + "?v=" + Date.now()); // Prevents caching issues
        if (!res.ok) throw new Error("Load failed");
        const text = await res.text();
        return text.split(/\r?\n/)
                   .map(w => w.trim().toLowerCase())
                   .filter(w => /^[a-z]{5}$/.test(w));
    } catch (e) { 
        console.error("Error loading file:", path, e);
        return []; 
    }
}

async function init() {
    showStatus("Loading engine...");
    
    // Promise.all ensures we wait for BOTH files before proceeding
    const [solList, guessList] = await Promise.all([
        loadWordFile("solutions.txt"),
        loadWordFile("guesses.txt")
    ]);

    SOLUTIONS = solList;
    VALID_GUESSES = guessList;

    // Merge solutions into guesses for safety
    SOLUTIONS.forEach(w => { if (!VALID_GUESSES.includes(w)) VALID_GUESSES.push(w); });

    if (VALID_GUESSES.length === 0) {
        showStatus("Critical Error: Word list empty.");
        return;
    }

    checkUserIdentity();
    initBoard();
    initKeyboard();
    bindUI();
    startDaily();
    showStatus("Lumiere Wordle Ready");
}

/* =========================================================
   2. IDENTITY MANAGEMENT
   ========================================================= */
function checkUserIdentity() {
    if (!userName || userName === "Anonymous") {
        const name = prompt("Welcome! Please enter your name for challenges:");
        userName = (name && name.trim()) ? name.trim() : "Anonymous";
        localStorage.setItem("lumiere_username", userName);
    }
}

/* =========================================================
   3. GAME ENGINE CORE
   ========================================================= */
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

    // Reset Visuals
    for (const k in keyStates) delete keyStates[k];
    initBoard();
    initKeyboard();
}

function submitGuess() {
    if (gameOver || currentGuess.length !== COLS) return;

    // Check against the now-fully-loaded VALID_GUESSES list
    if (!VALID_GUESSES.includes(currentGuess)) {
        showStatus("Not in word list");
        board.children[currentRow].classList.add("shake");
        setTimeout(() => board.children[currentRow].classList.remove("shake"), 500);
        return;
    }

    if (currentRow === 0) startTimer();

    const result = scoreGuess(currentGuess, solution);
    const guessToProcess = currentGuess;
    gameOver = true; // Lock input during animation

    result.forEach((res, i) => {
        const tile = board.children[currentRow].children[i];
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

function scoreGuess(guess, sol) {
    const res = Array(COLS).fill("absent");
    const solArr = sol.split("");
    // First pass: Correct spots
    for (let i = 0; i < COLS; i++) {
        if (guess[i] === sol[i]) { 
            res[i] = "correct"; 
            solArr[i] = null; 
        }
    }
    // Second pass: Present spots
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
   4. CHALLENGE SYSTEM
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
        showStatus("Challenge copied to clipboard!");
    });
}

function loadChallenge(input) {
    const nameMatch = input.match(/Created by:\s*([^\n\r]+)/i);
    challengeCreator = nameMatch ? nameMatch[1].trim() : "Anonymous";

    const match = input.match(/`([^`]+)`/) || input.match(/[A-Za-z0-9+/]{4,}/);
    const code = match ? (match[1] || match[0]).trim() : null;
    const word = code ? decodeWord(code) : null;

    if (word) {
        mode = "challenge";
        startGame(word);
        showStatus(`Challenge by ${challengeCreator} started!`);
    } else {
        showStatus("Invalid Code");
    }
}

/* =========================================================
   5. UI & UTILITIES
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
    
    const row = board.children[currentRow];
    [...row.children].forEach((tile, i) => tile.textContent = currentGuess[i] || "");
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

function startDaily() {
    mode = "daily";
    challengeCreator = "";
    const start = new Date("2021-06-19");
    const index = Math.floor((new Date() - start) / 86400000);
    startGame(SOLUTIONS[index % SOLUTIONS.length]);
}

function checkGameState(guess) {
    if (guess === solution) {
        clearInterval(timerInterval);
        setTimeout(() => showResults(true), 500);
    } else if (++currentRow === ROWS) {
        clearInterval(timerInterval);
        setTimeout(() => showResults(false), 500);
    } else {
        gameOver = false; // Unlock for next row
    }
}

function showResults(win) {
    const timeStr = timerDisplay.textContent;
    resultTitle.innerText = win ? `Solved in ${timeStr}!` : `Word: ${solution.toUpperCase()}`;
    
    let grid = "";
    for (let r = 0; r < ROWS; r++) {
        const row = board.children[r];
        if (!row.children[0].classList.contains("absent") && 
            !row.children[0].classList.contains("present") && 
            !row.children[0].classList.contains("correct")) break;
        
        [...row.children].forEach(tile => {
            if (tile.classList.contains("correct")) grid += "🟩";
            else if (tile.classList.contains("present")) grid += "🟨";
            else grid += "⬜";
        });
        grid += "\n";
    }

    resultGrid.textContent = `LUMIERE WORDLE\n${mode === "challenge" ? "Puzzle by: " + challengeCreator : "Daily Mode"}\n${grid}`;
    modal.classList.remove("hidden");
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

function startTimer() {
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

function showStatus(msg) {
    statusBar.textContent = msg;
    statusBar.classList.remove("hidden");
    setTimeout(() => statusBar.classList.add("hidden"), 2000);
}

function bindUI() {
    dailyBtn.onclick = startDaily;
    challengeBtn.onclick = () => challengePanel.classList.toggle("hidden");
    loadChallengeBtn.onclick = () => loadChallenge(challengeInput.value.trim());
    createChallengeBtn.onclick = createChallenge;
    pasteChallengeBtn.onclick = async () => {
        const t = await navigator.clipboard.readText();
        challengeInput.value = t;
        loadChallenge(t);
    };
    copyResultBtn.onclick = () => {
        navigator.clipboard.writeText(resultGrid.textContent);
        showStatus("Copied!");
    };
    document.getElementById("playAgain").onclick = startDaily;
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("hidden"); };
}

// Start Engine
init();
