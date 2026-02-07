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
  
  // Only add data-key for letter keys
  if (label.length === 1 && label !== "⌫") {
    key.dataset.key = label.toLowerCase();
  }
  
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
  // 1. Force the modal to hide
  modal.classList.add("hidden"); 

  // 2. Reset game state
  solution = word;
  currentRow = 0;
  currentGuess = "";
  gameOver = false;

  // 3. Reset Keyboard State
  for (const k in keyStates) delete keyStates[k];
  
  // Reset all keyboard key colors
  document.querySelectorAll(".key").forEach(key => {
    key.classList.remove("absent", "present", "correct");
    // Reset to default background
    key.style.background = "";
  });

  // 4. Reset board
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
   GUESS SUBMISSION (FIXED VERSION)
   ========================================================= */
function submitGuess() {
  const row = board.children[currentRow];

  // 1. Check length
  if (currentGuess.length !== COLS) {
    showStatus("Not enough letters");
    return;
  }

  // 2. Check validity + Shake Animation
  if (!VALID_GUESSES.includes(currentGuess)) {
    showStatus("Not in word list");
    row.classList.add("shake");
    setTimeout(() => row.classList.remove("shake"), 500);
    return;
  }

  const result = scoreGuess(currentGuess, solution);
  const guessToProcess = currentGuess;
  
  // Lock input during animation
  gameOver = true;

  // 3. Animate and reveal tiles
  result.forEach((res, i) => {
    const tile = row.children[i];
    const letter = guessToProcess[i];
    
    setTimeout(() => {
      // Start flip animation
      tile.classList.add("flip");
      
      // At the midpoint of flip (250ms), update color AND ensure letter stays
      setTimeout(() => {
        // Update tile state
        tile.classList.add(res);
        tile.textContent = letter; // Re-apply letter to ensure visibility
        
        // Update keyboard for this letter
        updateKeyboardForLetter(letter, res);
        
        // On last tile, check game state
        if (i === COLS - 1) {
          checkGameState(guessToProcess);
        }
      }, 250);
      
    }, i * 300); // Stagger each tile
  });

  currentGuess = "";
}

/* =========================================================
   UPDATE KEYBOARD FOR SINGLE LETTER
   ========================================================= */
function updateKeyboardForLetter(letter, state) {
  const keyEl = document.querySelector(`.key[data-key="${letter}"]`);
  if (!keyEl) return;
  
  const oldState = keyStates[letter];
  
  // Only update if new state has higher priority
  if (!oldState || STATE_PRIORITY[state] > STATE_PRIORITY[oldState]) {
    keyStates[letter] = state;
    
    // Remove all state classes
    keyEl.classList.remove("absent", "present", "correct");
    
    // Add new state class
    keyEl.classList.add(state);
  }
}

/* =========================================================
   UPDATE KEYBOARD (SIMPLIFIED VERSION)
   ========================================================= */
function updateKeyboard(guess, result) {
  for (let i = 0; i < COLS; i++) {
    const letter = guess[i];
    const state = result[i];
    updateKeyboardForLetter(letter, state);
  }
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

document.getElementById("playAgain").onclick = () => {
  modal.classList.add("hidden");
  startDaily();
};

/* =========================================================
   CHALLENGE MODE
   ========================================================= */
function createChallenge() {
  const word = prompt("Enter a 5-letter word to challenge your friends:")?.toLowerCase();
  
  if (!word || !VALID_GUESSES.includes(word)) {
    showStatus("Invalid word - must be a 5-letter dictionary word");
    return;
  }

  const code = encodeWord(word);
  const gameUrl = "https://aioch13.github.io/wordle/";
  
  // Format the Discord Message with clear code formatting
  const discordMessage = 
`🧩 LUMIERE WORDLE CHALLENGE 🧩

Can you guess my secret word? 

**Play here:** ${gameUrl}

**Challenge Code:** 
\`${code}\`

*(Copy JUST the code above, open the link, click 'Challenge', and paste it!)*`;

  // Copy the full message to clipboard
  navigator.clipboard.writeText(discordMessage).then(() => {
    showStatus("Challenge invite copied to clipboard!");
    
    // Optional: Show the code in the challenge panel for easy copy
    challengeInput.value = code;
    challengePanel.classList.remove("hidden");
  });
}

function pasteChallenge() {
  navigator.clipboard.readText().then(text => {
    if (!text) {
      showStatus("Clipboard is empty");
      return;
    }
    
    const code = extractChallengeCode(text);
    
    if (code) {
      challengeInput.value = code;
      showStatus("Challenge code extracted and pasted!");
      
      // Optionally auto-start the challenge
      // Uncomment the next line if you want to auto-start when code is detected:
      // setTimeout(() => loadChallenge(code), 500);
    } else {
      // If no code found, paste the raw text and let user edit
      challengeInput.value = text;
      showStatus("Pasted text - please edit to show just the challenge code");
    }
  }).catch(err => {
    showStatus("Failed to read clipboard");
    console.error("Clipboard error:", err);
  });
}

/* =========================================================
   CHALLENGE MODE - SMART LOADING
   ========================================================= */
function loadChallenge(input) {
  if (!input) {
    showStatus("Please enter or paste a challenge code");
    return;
  }
  
  // Use the smart extractor to find the challenge code
  const code = extractChallengeCode(input);
  
  if (!code) {
    showStatus("Could not find a valid challenge code in the input");
    return;
  }
  
  const word = decodeWord(code);
  if (!word || !VALID_GUESSES.includes(word)) {
    showStatus("Invalid challenge code - word not found");
    return;
  }

  mode = "challenge";
  challengeCode = code;
  startGame(word);
  showStatus("Challenge started!");
  
  // Update the input field with just the extracted code for clarity
  challengeInput.value = code;
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
/* =========================================================
   SMART CHALLENGE CODE EXTRACTOR
   ========================================================= */
function extractChallengeCode(text) {
  if (!text) return null;
  
  // Trim the text
  text = text.trim();
  
  // First, try to find the code in backticks (Discord code blocks)
  const backtickMatch = text.match(/`([^`]+)`/);
  if (backtickMatch) {
    const codeInBackticks = backtickMatch[1].trim();
    // If it's valid base64 (or looks like our challenge code), return it
    if (isValidChallengeCode(codeInBackticks)) {
      return codeInBackticks;
    }
  }
  
  // Try to find any standalone base64 string (no spaces, contains + or /, alphanumeric)
  const base64Regex = /[A-Za-z0-9+/]{8,}/g;
  const matches = text.match(base64Regex);
  
  if (matches) {
    // Return the longest match (most likely to be the challenge code)
    const longestMatch = matches.sort((a, b) => b.length - a.length)[0];
    if (isValidChallengeCode(longestMatch)) {
      return longestMatch;
    }
  }
  
  // Look for "Challenge Code:" or "Code:" pattern
  const codePatterns = [
    /challenge code:\s*([A-Za-z0-9+/]+)/i,
    /code:\s*([A-Za-z0-9+/]+)/i,
    /challenge:\s*([A-Za-z0-9+/]+)/i
  ];
  
  for (const pattern of codePatterns) {
    const match = text.match(pattern);
    if (match && match[1] && isValidChallengeCode(match[1])) {
      return match[1];
    }
  }
  
  // Last resort: try the entire text if it looks like a challenge code
  if (isValidChallengeCode(text)) {
    return text;
  }
  
  return null;
}

function isValidChallengeCode(code) {
  // Challenge codes should be base64 (alphanumeric, +, /) and not too long
  if (!code || code.length < 4 || code.length > 30) return false;
  
  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(code)) return false;
  
  // Try to decode it to see if it's a valid word
  try {
    const word = decodeWord(code);
    return word && word.length === 5 && VALID_GUESSES.includes(word);
  } catch {
    return false;
  }
}
