<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Lumiere Wordle</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    /* Additional styles for logo and timer */
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .header-logo {
      height: 36px;
      width: 36px;
      border-radius: 4px;
      object-fit: cover;
    }
    
    #timerDisplay {
      font-size: 14px;
      font-weight: 600;
      color: #56a550;
      background: rgba(86, 165, 80, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
      min-width: 60px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  </style>
</head>
<body>

  <!-- =========================================================
       HEADER
       ========================================================= -->
  <header>
    <div class="header-left">
      <img src="logo.png" alt="Lumiere Logo" class="header-logo">
      <h1>LUMIERE WORDLE</h1>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <div id="timerDisplay">00:00</div>
      <div class="mode-buttons">
        <button id="dailyBtn">Daily</button>
        <button id="challengeBtn">Challenge</button>
      </div>
    </div>
  </header>

  <!-- =========================================================
       STATUS BAR (NON-MODAL FEEDBACK)
       ========================================================= -->
  <div id="status" class="status hidden"></div>

  <!-- =========================================================
       GAME BOARD
       ========================================================= -->
  <div id="board"></div>

  <!-- =========================================================
       CHALLENGE PANEL
       ========================================================= -->
  <div id="challengePanel" class="hidden">
    <input
      id="challengeInput"
      type="text"
      placeholder="Paste challenge code"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
    />
    <button id="loadChallenge">Start</button>
    <button id="pasteChallenge">Paste</button>
    <button id="createChallenge">Create</button>
  </div>

  <!-- =========================================================
       KEYBOARD
       ========================================================= -->
  <div id="keyboard"></div>

  <!-- =========================================================
       RESULT MODAL
       ========================================================= -->
  <div id="modal" class="hidden">
    <div class="modal-content">
      <div id="resultTitle"></div>
      <pre id="resultGrid"></pre>
      <button id="copyResult">Copy</button>
      <button id="playAgain">Play Again</button>
    </div>
  </div>

  <!-- =========================================================
       SCRIPT
       ========================================================= -->
  <script src="script.js"></script>

</body>
</html>
