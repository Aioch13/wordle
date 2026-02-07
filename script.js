/* =========================================================
   LUMIERE WORDLE – PRO ENGINE (V3.3 WITH SPINNER)
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
let timerInterval = null;
let elapsedTime = 0;

/* ---------------- KEYBOARD STATE ---------------- */
const keyStates = {};
const STATE_PRIORITY = { absent: 1, present: 2, correct: 3 };

/* ---------------- CONSTANTS ---------------- */
const ROWS = 6;
const COLS = 5;
const SALT = 9137;

/* ---------------- DOM ELEMENTS ---------------- */
const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const timerDisplay = document.getElementById("timerDisplay");
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
const loadingOverlay = document.getElementById("loadingOverlay");

/* =========================================================
   STATUS MESSAGE
   ========================================================= */
function showStatus(msg, timeout = 2000) {
  if (!statusBar) return;
  
  statusBar.textContent = msg;
  statusBar.classList.remove("hidden");

  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    if (statusBar) {
      statusBar.classList.add("hidden");
    }
  }, timeout);
}

/* =========================================================
   LOAD WORD LISTS - FIXED VERSION
   ========================================================= */
async function loadWordFile(path) {
  try {
    console.log(`Loading word file: ${path}`);
    const res = await fetch(path + "?v=" + Date.now());
    
    if (!res.ok) {
      throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
    }
    
    const text = await res.text();
    console.log(`Raw text from ${path} (first 100 chars):`, text.substring(0, 100));
    
    // Handle different line endings and clean the data
    const words = text
      .replace(/\r\n/g, '\n')  // Windows line endings
      .replace(/\r/g, '\n')    // Old Mac line endings
      .split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length === 5 && /^[a-z]+$/.test(w));
    
    console.log(`Loaded ${words.length} words from ${path}`);
    
    // Debug: Check for "squid"
    if (words.includes('squid')) {
      console.log(`✓ "squid" found in ${path}`);
    }
    
    return words;
  } catch (error) {
    console.error(`Error loading ${path}:`, error);
    return [];
  }
}

async function loadWords() {
  const [solList, guessList] = await Promise.all([
    loadWordFile("solutions.txt"),
    loadWordFile("guesses.txt")
  ]);

  SOLUTIONS = solList;
  VALID_GUESSES = guessList;
  
  console.log(`=== WORD LIST SUMMARY ===`);
  console.log(`Solutions count: ${SOLUTIONS.length}`);
  console.log(`Guesses count before merge: ${VALID_GUESSES.length}`);
  
  // Check if "squid" exists in either list
  console.log(`"squid" in solutions? ${SOLUTIONS.includes('squid')}`);
  console.log(`"squid" in guesses? ${VALID_GUESSES.includes('squid')}`);
  
  // Merge solutions into guesses without duplicates
  const mergedSet = new Set([...VALID_GUESSES, ...SOLUTIONS]);
  VALID_GUESSES = Array.from(mergedSet);
  
  console.log(`Total valid words after merge: ${VALID_GUESSES.length}`);
  console.log(`"squid" in merged list? ${VALID_GUESSES.includes('squid')}`);
  
  // Sort for easier debugging (optional)
  VALID_GUESSES.sort();
  SOLUTIONS.sort();
  
  // Test common words
  const testWords = ['squid', 'apple', 'brain', 'cloud', 'drama'];
  console.log(`=== WORD VALIDATION TEST ===`);
  testWords.forEach(word => {
    console.log(`"${word}": ${VALID_GUESSES.includes(word) ? 'VALID' : 'INVALID'}`);
  });
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
    if (isValidChallengeCode(codeInBackticks)) {
      return codeInBackticks;
    }
  }
  
  // Try to find any standalone base64 string
  const base64Regex = /[A-Za-z0-9+/]{8,}/g;
  const matches = text.match(base64Regex);
  
  if (matches) {
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
  
  // Last resort: try the entire text
  if (isValidChallengeCode(text)) {
    return text;
  }
  
  return null;
}

function isValidChallengeCode(code) {
  if (!code || code.length < 4 || code.length > 30) return false;
  
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(code)) return false;
  
  try {
    const word = decodeWord(code);
    return word && word.length === 5 && VALID_GUESSES.includes(word);
  } catch {
    return false;
  }
}

/* =========================================================
   REAL-TIME CHALLENGE CODE VALIDATION
   ========================================================= */
function validateChallengeInput() {
  const input = challengeInput.value.trim();
  
  if (!input) {
    challengeInput.classList.remove("valid", "invalid");
    return;
  }
  
  const code = extractChallengeCode(input);
  
  if (code && isValidChallengeCode(code)) {
    challengeInput.classList.add("valid");
    challengeInput.classList.remove("invalid");
  } else {
    challengeInput.classList.add("invalid");
    challengeInput.classList.remove("valid");
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
    elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
  }
}

function resetTimer() {
  stopTimer();
  gameStartTime = null;
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
async function init() {
  // Show loading overlay
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.classList.remove("fade-out");
  }
  
  try {
    await loadWords();
    initBoard();
    initKeyboard();
    bindUI();
    startDaily();
    
    console.log("Game initialized successfully!");
  } catch (error) {
    console.error("Error during initialization:", error);
    showStatus("Error loading game. Please refresh.");
  } finally {
    // Hide loading overlay
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.add("fade-out");
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
        }, 500);
      }, 500);
    }
  }
}

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
  // Swapped ENTER and DELETE positions
  const keyboardLayout = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
  ];

  keyboard.innerHTML = "";

  keyboardLayout.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyboard-row";

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
  // Keyboard input
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

  // Modal "Click Outside to Close"
  if (modal) {
    modal.onclick = e => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    };
  }

  // Button event listeners
  if (dailyBtn) dailyBtn.onclick = startDaily;
  
  if (challengeBtn) {
    challengeBtn.onclick = () => {
      if (challengePanel) {
        challengePanel.classList.toggle("hidden");
        if (!challengePanel.classList.contains("hidden")) {
          validateChallengeInput();
        }
      }
    };
  }
  
  if (loadChallengeBtn) {
    loadChallengeBtn.onclick = () => loadChallenge(challengeInput.value.trim());
  }
  
  if (createChallengeBtn) createChallengeBtn.onclick = createChallenge;
  if (pasteChallengeBtn) pasteChallengeBtn.onclick = pasteChallenge;
  
  if (copyResultBtn) {
    copyResultBtn.onclick = copyResults;
  }
  
  if (challengeInput) {
    challengeInput.addEventListener('input', validateChallengeInput);
  }
  
  // Play Again button
  const playAgainBtn = document.getElementById("playAgain");
  if (playAgainBtn) {
    playAgainBtn.onclick = () => {
      modal.classList.add("hidden");
      startDaily();
    };
  }
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
  console.log(`Starting game with word: ${word}`);
  
  // Force the modal to hide
  if (modal) {
    modal.classList.add("hidden");
  }
  
  // Reset copy button state
  if (copyResultBtn) {
    copyResultBtn.textContent = "Copy";
    copyResultBtn.style.background = "";
  }

  // Reset game state
  solution = word;
  currentRow = 0;
  currentGuess = "";
  gameOver = false;
  
  // Reset timer
  resetTimer();
  
  // Reset Keyboard State
  for (const k in keyStates) delete keyStates[k];
  
  // Reset all keyboard key colors
  document.querySelectorAll(".key").forEach(key => {
    key.classList.remove("absent", "present", "correct");
    key.style.background = "";
  });

  // Reset board
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
  console.log(`Checking word: "${currentGuess}"`);
  console.log(`Is "${currentGuess}" in VALID_GUESSES? ${VALID_GUESSES.includes(currentGuess)}`);
  
  if (!VALID_GUESSES.includes(currentGuess)) {
    console.log(`"${currentGuess}" not found in word list. Total valid guesses: ${VALID_GUESSES.length}`);
    
    // Debug search for the word
    if (currentGuess === 'squid') {
      console.log(`Debug search for "squid":`);
      console.log(`First 50 valid guesses:`, VALID_GUESSES.slice(0, 50));
      console.log(`Looking for exact match...`);
      for (let i = 0; i < VALID_GUESSES.length; i++) {
        if (VALID_GUESSES[i] === 'squid') {
          console.log(`Found "squid" at index ${i}!`);
          break;
        }
      }
    }
    
    showStatus("Not in word list");
    row.classList.add("shake");
    setTimeout(() => row.classList.remove("shake"), 500);
    return;
  }

  console.log(`"${currentGuess}" is VALID!`);
  
  // 3. Start timer on first valid guess
  if (currentRow === 0 && !gameStartTime) {
    startTimer();
  }

  const result = scoreGuess(currentGuess, solution);
  const guessToProcess = currentGuess;
  
  // Lock input during animation
  gameOver = true;

  // 4. Animate and reveal tiles
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
   CHECK GAME STATE
   ========================================================= */
function checkGameState(guess) {
  if (guess === solution) {
    setTimeout(() => endGame(true), 500);
  } else if (currentRow + 1 === ROWS) {
    setTimeout(() => endGame(false), 500);
  } else {
    currentRow++;
    gameOver = false; // Re-enable input for next row
  }
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
   END GAME
   ========================================================= */
function endGame(win) {
  gameOver = true;
  stopTimer();
  showResults(win);
}

function showResults(win) {
  // Reset copy button state when showing new results
  if (copyResultBtn) {
    copyResultBtn.textContent = "Copy";
    copyResultBtn.style.background = "";
  }
  
  const timeUsed = elapsedTime;
  const timeString = formatTime(timeUsed);
  
  if (resultTitle) {
    resultTitle.textContent = win
      ? `Solved in ${timeString} • ${currentRow + 1}/${ROWS}`
      : `Failed in ${timeString} • Word was ${solution}`;
  }

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
  
  // Add timer to results for copying
  let resultText = "";
  if (mode === "challenge") {
    resultText = `Lumiere Wordle Challenge ${challengeCode}\n`;
  } else {
    resultText = `Lumiere Wordle Daily\n`;
  }
  
  resultText += `${win ? `Solved in ${timeString}` : `Failed in ${timeString}`} • ${currentRow + 1}/${ROWS}\n\n`;
  resultText += grid;
  
  if (mode === "challenge") {
    resultText += `\nChallenge your friends: https://aioch13.github.io/wordle/`;
  }

  if (resultGrid) {
    resultGrid.textContent = resultText;
  }
  
  if (modal) {
    modal.classList.remove("hidden");
  }
}

function copyResults() {
  if (!resultGrid) return;
  
  const resultText = resultGrid.textContent;
  navigator.clipboard.writeText(resultText)
    .then(() => {
      // Show feedback with time
      const timeMatch = resultText.match(/Solved in (\d+:\d+)/) || resultText.match(/Failed in (\d+:\d+)/);
      const timeText = timeMatch ? ` (${timeMatch[1]})` : '';
      
      if (copyResultBtn) {
        copyResultBtn.textContent = `✓ Copied${timeText}!`;
        copyResultBtn.style.background = "#2d7a28";
        
        // Reset after 2 seconds
        setTimeout(() => {
          if (copyResultBtn) {
            copyResultBtn.textContent = "Copy";
            copyResultBtn.style.background = "";
          }
        }, 2000);
      }
    })
    .catch(err => {
      console.error("Copy failed:", err);
      showStatus("Failed to copy results");
    });
}

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
  const gameUrl = window.location.href.split('?')[0];
  
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
    
    // Show the code in the challenge panel for easy copy
    if (challengeInput) {
      challengeInput.value = code;
    }
    if (challengePanel) {
      challengePanel.classList.remove("hidden");
    }
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
      if (challengeInput) {
        challengeInput.value = code;
      }
      showStatus("Challenge code extracted and pasted!");
    } else {
      if (challengeInput) {
        challengeInput.value = text;
      }
      showStatus("Pasted text - please edit to show just the challenge code");
    }
  }).catch(err => {
    console.error("Clipboard error:", err);
    showStatus("Failed to read clipboard");
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
  if (challengeInput) {
    challengeInput.value = code;
  }
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
   FALLBACK WORD LIST (in case files don't load)
   ========================================================= */
const FALLBACK_WORDS = [
  'squid', 'apple', 'brain', 'cloud', 'drama', 'earth', 'flame', 'grape',
  'house', 'image', 'joker', 'kings', 'lemon', 'music', 'night', 'olive',
  'piano', 'queen', 'river', 'snake', 'tiger', 'umbra', 'vivid', 'whale',
  'xenon', 'yacht', 'zebra'
];

// Initialize the game
init();
