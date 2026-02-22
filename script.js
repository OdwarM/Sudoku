// =============================================
// FIREBASE KONFIGURACE
// =============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, getDocs, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvuIqYsTUiVzgul9EONxOhYJaIR2h4N4g",
  authDomain: "sudoku-hra.firebaseapp.com",
  projectId: "sudoku-hra",
  storageBucket: "sudoku-hra.firebasestorage.app",
  messagingSenderId: "563384061510",
  appId: "1:563384061510:web:951665831fd6a757e40447"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================================
// HLAVNÍ LOGIKA HRY
// =============================================
document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTY ---
    const sudokuGrid             = document.getElementById('sudoku-grid');
    const newGameBtn             = document.getElementById('new-game-btn');
    const checkSolutionBtn       = document.getElementById('check-solution-btn');
    const messageDisplay         = document.getElementById('message');
    const difficultySelect       = document.getElementById('difficulty');
    const numberButtonsContainer = document.getElementById('number-buttons');
    const timerDisplay           = document.getElementById('timer');
    const deleteNumbersBtn       = document.getElementById('delete-numbers');
    const nicknameOverlay        = document.getElementById('nickname-overlay');
    const nicknameInput          = document.getElementById('nickname-input');
    const nicknameConfirmBtn     = document.getElementById('nickname-confirm-btn');
    const playerNameDisplay      = document.getElementById('player-name-display');
    const changeNameBtn          = document.getElementById('change-name-btn');
    const leaderboardList        = document.getElementById('leaderboard-list');
    const leaderboardToggle      = document.getElementById('leaderboard-toggle');
    const leaderboardBody        = document.getElementById('leaderboard-body');
    const leaderboardToggleIcon  = document.getElementById('leaderboard-toggle-icon');
    const leaderboardModeNote    = document.getElementById('leaderboard-mode-note');
    const newgameOverlay         = document.getElementById('newgame-overlay');
    const newgameCompetitionBtn  = document.getElementById('newgame-competition-btn');
    const newgameCasualBtn       = document.getElementById('newgame-casual-btn');
    const newgameCancelBtn       = document.getElementById('newgame-cancel-btn');
    const startBtn               = document.getElementById('start-btn');
    const startArea              = document.getElementById('start-area');
    const gameControls           = document.getElementById('game-controls');

    // --- STAV HRY ---
    let initialGrid    = [];
    let solvedGrid     = [];
    let currentGrid    = [];
    let frozenNumbers  = new Set();
    let selectedCell   = null;
    let activeNumber   = null;
    let timerInterval  = null;
    let timerSeconds   = 0;
    let timerRunning   = false;
    let playerNickname = '';
    let todayPuzzleId  = '';
    let puzzleSeed     = 0;
    let isCasualMode   = false;
    let casualSeed     = 0;
    let isChallengeMode = false;
    let challengeGrid  = null;
    let leaderboardUnsubscribe = null;
    let gameStarted    = false;  // Hra byla odstartována tlačítkem START?

    // Upravené obtížnosti
    const DIFFICULTY_MAP = { 'easy': 30, 'medium': 40, 'hard': 50 };

    // =============================================
    // NICKNAME
    // =============================================
    function initNickname() {
        const saved = localStorage.getItem('sudoku_nickname');
        if (saved) {
            playerNickname = saved;
            playerNameDisplay.textContent = saved;
            nicknameOverlay.style.display = 'none';
        } else {
            nicknameOverlay.style.display = 'flex';
            nicknameInput.focus();
        }
    }

    function confirmNickname() {
        const name = nicknameInput.value.trim();
        if (!name) { nicknameInput.style.borderColor = '#dc3545'; return; }
        playerNickname = name;
        localStorage.setItem('sudoku_nickname', name);
        playerNameDisplay.textContent = name;
        nicknameOverlay.style.display = 'none';
        startCompetitionGame(); // První hra vždy soutěžní
    }

    nicknameConfirmBtn.addEventListener('click', confirmNickname);
    nicknameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmNickname(); });
    changeNameBtn.addEventListener('click', () => {
        localStorage.removeItem('sudoku_nickname');
        nicknameInput.value = '';
        nicknameInput.style.borderColor = '';
        nicknameOverlay.style.display = 'flex';
        nicknameInput.focus();
    });

    // =============================================
    // DIALOG NOVÁ HRA
    // =============================================
    newGameBtn.addEventListener('click', () => {
        newgameOverlay.style.display = 'flex';
    });

    newgameCompetitionBtn.addEventListener('click', () => {
        newgameOverlay.style.display = 'none';
        startCompetitionGame();
    });

    newgameCasualBtn.addEventListener('click', () => {
        newgameOverlay.style.display = 'none';
        startCasualGame();
    });

    newgameCancelBtn.addEventListener('click', () => {
        newgameOverlay.style.display = 'none';
    });

    // Toggle žebříčku
    leaderboardToggle.addEventListener('click', () => {
        const isOpen = leaderboardBody.style.display !== 'none';
        leaderboardBody.style.display = isOpen ? 'none' : 'block';
        leaderboardToggleIcon.textContent = isOpen ? '▼' : '▲';
    });

    // Tlačítko START — odkryje čísla a spustí časovač
    startBtn.addEventListener('click', () => {
        if (gameStarted) return;
        gameStarted = true;
        sudokuGrid.classList.remove('hidden-grid');
        startArea.style.display = 'none';
        gameControls.className = 'game-controls-visible';
        startTimer();
    });

    difficultySelect.addEventListener('change', () => {
        // Při změně obtížnosti spusť stejný typ hry jako teď
        if (isCasualMode) startCasualGame();
        else startCompetitionGame();
    });

    // =============================================
    // PUZZLE ID + SEED
    // =============================================
    function getTodayPuzzleId(difficulty) {
        const today = new Date();
        return `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}_${difficulty}`;
    }

    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function makeRng(seed) {
        let s = seed;
        return function() {
            s |= 0; s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // =============================================
    // LOGIKA SUDOKU
    // =============================================
    function generateEmptyGrid() {
        return Array(9).fill(null).map(() => Array(9).fill(0));
    }

    function solveSudoku(grid) {
        const N = 9;
        const findEmpty = (g) => {
            for (let r = 0; r < N; r++)
                for (let c = 0; c < N; c++)
                    if (g[r][c] === 0) return [r, c];
            return null;
        };
        const isValid = (num, pos, g) => {
            const [r, c] = pos;
            for (let col = 0; col < N; col++) if (g[r][col] === num && col !== c) return false;
            for (let row = 0; row < N; row++) if (g[row][c] === num && row !== r) return false;
            const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
            for (let row = br; row < br+3; row++)
                for (let col = bc; col < bc+3; col++)
                    if (g[row][col] === num && (row !== r || col !== c)) return false;
            return true;
        };
        const solve = (g) => {
            const pos = findEmpty(g);
            if (!pos) return true;
            const [r, c] = pos;
            for (let num = 1; num <= 9; num++) {
                if (isValid(num, [r, c], g)) {
                    g[r][c] = num;
                    if (solve(g)) return true;
                    g[r][c] = 0;
                }
            }
            return false;
        };
        const solvedGrid = grid.map(row => [...row]);
        solve(solvedGrid);
        return solvedGrid;
    }

    function shuffleArrayWithRng(array, rng) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function generateSudokuWithSeed(difficulty, seed) {
        const rng = makeRng(seed);
        let grid = generateEmptyGrid();
        function fillBox(g, row, col) {
            let nums = [1,2,3,4,5,6,7,8,9];
            shuffleArrayWithRng(nums, rng);
            for (let r = 0; r < 3; r++)
                for (let c = 0; c < 3; c++)
                    g[row+r][col+c] = nums.pop();
        }
        fillBox(grid, 0, 0); fillBox(grid, 3, 3); fillBox(grid, 6, 6);
        grid = solveSudoku(grid);
        if (!grid || grid[0][0] === 0) return generateSudokuWithSeed(difficulty, seed + 1);
        const cellsToRemove = DIFFICULTY_MAP[difficulty];
        let cells = Array.from({length: 81}, (_, i) => i);
        shuffleArrayWithRng(cells, rng);
        for (let i = 0; i < cellsToRemove; i++) grid[Math.floor(cells[i]/9)][cells[i]%9] = 0;
        return grid;
    }

    // =============================================
    // ČASOVAČ
    // =============================================
    function formatTime(s) {
        return `⏱ ${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    }

    function startTimer() {
        stopTimer();
        timerSeconds = 0; timerRunning = true;
        timerDisplay.textContent = formatTime(0);
        timerDisplay.classList.remove('finished');
        timerInterval = setInterval(() => { timerSeconds++; timerDisplay.textContent = formatTime(timerSeconds); }, 1000);
    }

    function stopTimer() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerRunning = false;
    }

    // =============================================
    // VIZUÁL A INTERAKCE
    // =============================================
    function playSound() {
        const sound = new Audio('./sound/click.wav');
        sound.play().catch(() => {});
    }

    function clearNumberHighlights() {
        document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlighted'));
        document.querySelectorAll('.number-btn').forEach(b => b.classList.remove('active'));
    }

    function highlightSameNumbers(num) {
        clearNumberHighlights();
        if (!num) return;
        document.querySelectorAll('.cell').forEach(cell => {
            if (parseInt(cell.textContent) === num) cell.classList.add('highlighted');
        });
        const btn = document.querySelector(`.number-btn[data-number="${num}"]`);
        if (btn && !btn.disabled) btn.classList.add('active');
    }

    function showMessage(text, type = 'info') {
        messageDisplay.textContent = text;
        messageDisplay.style.color = type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#333');
    }

    // Zmrazí číslo — zašedne tlačítko a uzamkne políčka
    function freezeNumber(num) {
        frozenNumbers.add(num);

        // Zašedni tlačítko
        const btn = document.querySelector(`.number-btn[data-number="${num}"]`);
        if (btn) { btn.classList.add('completed'); btn.disabled = true; }

        // Uzamkni políčka s tímto číslem vizuálně (fixed styl)
        document.querySelectorAll('.cell').forEach(cell => {
            if (parseInt(cell.textContent) === num && !cell.classList.contains('fixed')) {
                cell.classList.add('fixed');
                cell.classList.remove('player-input', 'invalid');
            }
        });

        if (activeNumber === num) { activeNumber = null; clearNumberHighlights(); }
    }

    // Po zadání čísla zkontroluj jestli je kompletní a správné
    // Používá solvedGrid který se vypočítá jednou na začátku — initialGrid se nikdy nemění
    function checkNumberComplete(num) {
        let count = 0;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (currentGrid[r][c] === num) count++;
        if (count < 9) return;

        let allCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (currentGrid[r][c] === num && solvedGrid[r][c] !== num) {
                    allCorrect = false;
                    const cell = sudokuGrid.children[r * 9 + c];
                    if (!cell.classList.contains('fixed')) cell.classList.add('invalid');
                }
            }
        }

        if (allCorrect) freezeNumber(num);
    }

    function renderGrid(grid) {
        sudokuGrid.innerHTML = '';
        grid.forEach((row, rowIndex) => {
            row.forEach((num, colIndex) => {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = rowIndex;
                cell.dataset.col = colIndex;
                if (initialGrid[rowIndex][colIndex] !== 0) {
                    cell.classList.add('fixed');
                    cell.textContent = initialGrid[rowIndex][colIndex];
                } else {
                    cell.textContent = num !== 0 ? num : '';
                    if (num !== 0) cell.classList.add('player-input');
                }
                cell.addEventListener('click', handleCellClick);
                sudokuGrid.appendChild(cell);
            });
        });
        highlightSameNumbers(activeNumber);
    }

    // =============================================
    // HANDLERY INTERAKCE
    // =============================================
    function handleCellClick(event) {
        if (!gameStarted) return; // Hra nezačala, ignoruj kliknutí
        const targetCell = event.target;
        messageDisplay.textContent = '';
        if (selectedCell) selectedCell.classList.remove('selected');
        selectedCell = targetCell;
        selectedCell.classList.add('selected');
        const cellValue = parseInt(targetCell.textContent);
        highlightSameNumbers(cellValue >= 1 && cellValue <= 9 ? cellValue : activeNumber);
    }

    function writeNumberToCell(num) {
        if (!selectedCell || selectedCell.classList.contains('fixed')) return;
        if (frozenNumbers.has(num)) return;
        // Zámek: pokud buňka již obsahuje hráčem zadané číslo, nelze přepsat
        if (selectedCell.classList.contains('player-input')) return;
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        selectedCell.textContent = num;
        currentGrid[row][col] = num;
        selectedCell.classList.remove('invalid');
        selectedCell.classList.add('player-input');
        playSound();
        highlightSameNumbers(num);
        checkNumberComplete(num);
        checkAutoComplete();
    }

    // Spočítá počet prázdných políček
    function countEmptyCells() {
        let empty = 0;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (currentGrid[r][c] === 0) empty++;
        return empty;
    }

    // Automaticky doplní zbývající políčka pokud jich zbývá ≤ 5
    function checkAutoComplete() {
        if (countEmptyCells() > 5) return;
        // Doplň všechna zbývající prázdná políčka ze solvedGrid
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (currentGrid[r][c] === 0) {
                    currentGrid[r][c] = solvedGrid[r][c];
                    const cell = sudokuGrid.children[r * 9 + c];
                    cell.textContent = solvedGrid[r][c];
                    cell.classList.add('player-input', 'fixed');
                    cell.classList.remove('invalid');
                }
            }
        }
        // Spusť dokončení hry
        finishGame();
    }

    // Ukončení hry po auto-dokončení nebo manuální kontrole
    function finishGame() {
        stopTimer();
        timerDisplay.classList.add('finished');
        const m = String(Math.floor(timerSeconds/60)).padStart(2,'0');
        const s = String(timerSeconds%60).padStart(2,'0');
        showMessage(`🎉 Gratulujeme! Vyřešeno za ${m}:${s}!`, 'success');
        if (isCasualMode) {
            setTimeout(() => {
                const answer = confirm('Uložit tuto hru jako novou výzvu pro ostatní hráče?\n(Původní výzva bude nahrazena.)');
                if (answer) saveChallenge();
            }, 800);
        } else {
            saveResultToFirebase(timerSeconds);
            checkOfferSaveChallenge();
        }
    }

    function createNumberButtons() {
        numberButtonsContainer.innerHTML = '';
        frozenNumbers.clear();
        for (let i = 1; i <= 9; i++) {
            const button = document.createElement('div');
            button.classList.add('number-btn');
            button.textContent = i;
            button.dataset.number = i;
            button.addEventListener('click', handleNumberButtonClick);
            numberButtonsContainer.appendChild(button);
        }
    }

    function handleNumberButtonClick(event) {
        if (event.target.disabled) return;
        const num = parseInt(event.target.dataset.number);
        if (frozenNumbers.has(num)) return;

        if (selectedCell && !selectedCell.classList.contains('fixed')) {
            activeNumber = num;
            writeNumberToCell(num);
        } else {
            if (activeNumber === num) {
                activeNumber = null;
                clearNumberHighlights();
            } else {
                activeNumber = num;
                highlightSameNumbers(num);
                playSound();
            }
        }
    }

    function handleDeleteClick() {
        if (!selectedCell) { showMessage('Nejprve vyberte políčko.', 'error'); return; }
        if (selectedCell.classList.contains('fixed')) { showMessage('Nelze mazat toto políčko.', 'error'); return; }
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        if (frozenNumbers.has(currentGrid[row][col])) {
            showMessage('Toto číslo je již kompletní a uzamčené.', 'error'); return;
        }
        currentGrid[row][col] = 0;
        selectedCell.textContent = '';
        selectedCell.classList.remove('player-input', 'invalid');
        clearNumberHighlights();
        activeNumber = null;
        playSound();
        showMessage('Číslo bylo smazáno.', 'info');
    }

    document.addEventListener('keydown', (event) => {
        if (!gameStarted) return;
        if (!selectedCell || selectedCell.classList.contains('fixed')) return;
        const key = event.key;
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        if (key >= '1' && key <= '9') {
            const num = parseInt(key);
            if (frozenNumbers.has(num)) return;
            // Zámek: nelze přepsat již zadané číslo
            if (selectedCell.classList.contains('player-input')) return;
            activeNumber = num;
            writeNumberToCell(num);
        } else if (key === 'Backspace' || key === 'Delete') {
            if (frozenNumbers.has(currentGrid[row][col])) return;
            currentGrid[row][col] = 0;
            selectedCell.textContent = '';
            selectedCell.classList.remove('player-input', 'invalid');
            activeNumber = null;
            clearNumberHighlights();
            playSound();
        }
    });

    // Připraví UI před Startem — skryje čísla, ukáže tlačítko START
    function prepareGameUI() {
        gameStarted = false;
        sudokuGrid.classList.add('hidden-grid');
        startArea.style.display = 'block';
        gameControls.className = 'game-controls-hidden';
        timerDisplay.querySelector
        ? null : null;
        // Reset časovače na 00:00 ale nezačínej
        stopTimer();
        timerSeconds = 0;
        timerDisplay.textContent = '⏱ 00:00';
        timerDisplay.classList.remove('finished');
    }
    function checkSolution() {
        let isCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cellElement = sudokuGrid.children[r * 9 + c];
                cellElement.classList.remove('invalid');
                if (currentGrid[r][c] === 0) { isCorrect = false; continue; }
                if (currentGrid[r][c] !== solvedGrid[r][c]) {
                    isCorrect = false;
                    if (!cellElement.classList.contains('fixed')) cellElement.classList.add('invalid');
                }
            }
        }
        if (isCorrect) {
            finishGame();
        } else {
            showMessage('Zkontrolujte zvýrazněné (červené) buňky.', 'error');
        }
    }

    async function saveResultToFirebase(seconds) {
        try {
            // Zkontroluj jestli hráč již nemá výsledek pro toto puzzle
            const q = query(collection(db, 'results'),
                where('puzzleId', '==', todayPuzzleId),
                where('nickname', '==', playerNickname));
            const existing = await getDocs(q);
            if (!existing.empty) {
                showMessage('🎉 Skvělé! Tvůj výsledek byl již dříve uložen.', 'success');
                return;
            }
            await addDoc(collection(db, 'results'), {
                puzzleId: todayPuzzleId,
                nickname: playerNickname,
                seconds: seconds,
                timestamp: new Date()
            });
        } catch (e) { console.error('Chyba při ukládání výsledku:', e); }
    }

    // =============================================
    // SKÓRE HRÁČŮ
    // =============================================
    async function getPlayerScore(nickname) {
        try {
            const d = await getDoc(doc(db, 'scores', nickname));
            return d.exists() ? (d.data().points || 0) : 0;
        } catch (e) { return 0; }
    }

    async function addPointToPlayer(nickname) {
        try {
            const ref = doc(db, 'scores', nickname);
            const d = await getDoc(ref);
            const current = d.exists() ? (d.data().points || 0) : 0;
            await setDoc(ref, { nickname, points: current + 1 });
        } catch (e) { console.error('Chyba při přidávání bodu:', e); }
    }

    // =============================================
    // VÝZVA (CHALLENGE)
    // =============================================
    async function loadChallenge() {
        try {
            const challengeDoc = await getDoc(doc(db, 'challenge', 'current'));
            return challengeDoc.exists() ? challengeDoc.data() : null;
        } catch (e) { return null; }
    }

    async function saveChallenge() {
        try {
            const challengePuzzleId = `challenge_${Date.now()}`;

            // 1. Přidej bod vítězi předchozí výzvy (hráč s nejlepším časem)
            const oldChallenge = await loadChallenge();
            if (oldChallenge && oldChallenge.puzzleId) {
                const oldResults = await getDocs(
                    query(collection(db, 'results'),
                        where('puzzleId', '==', oldChallenge.puzzleId),
                        orderBy('seconds', 'asc'))
                );
                // Bod dostane jen pokud byli alespoň 2 hráči
                if (oldResults.size >= 2) {
                    const winner = oldResults.docs[0].data().nickname;
                    await addPointToPlayer(winner);
                    showMessage(`🏆 Bod připsán hráči ${winner}!`, 'success');
                }
                // Smaž staré výsledky
                for (const d of oldResults.docs) await deleteDoc(d.ref);
            }

            // 2. Ulož novou výzvu
            await setDoc(doc(db, 'challenge', 'current'), {
                puzzleId: challengePuzzleId,
                grid: initialGrid.map(row => [...row]),
                difficulty: difficultySelect.value,
                createdBy: playerNickname,
                createdAt: new Date()
            });

            // 3. Ulož čas zakladatele jako první výsledek nové výzvy
            await addDoc(collection(db, 'results'), {
                puzzleId: challengePuzzleId,
                nickname: playerNickname,
                seconds: timerSeconds,
                timestamp: new Date()
            });

            // 4. Přepni na nové challenge ID a obnov žebříček
            todayPuzzleId = challengePuzzleId;
            isCasualMode = false; // Žebříček musí sledovat nové challenge ID
            listenLeaderboard();

            showMessage('✅ Nová výzva uložena! Jsi první v novém žebříčku.', 'success');
        } catch (e) { console.error('Chyba při ukládání výzvy:', e); }
    }

    async function checkOfferSaveChallenge() {
        try {
            const q = query(collection(db, 'results'), where('puzzleId', '==', todayPuzzleId));
            const snap = await getDocs(q);
            if (snap.size >= 2) {
                setTimeout(() => {
                    const answer = confirm('Uložit tuto hru jako novou výzvu pro ostatní hráče?\n(Původní výzva bude nahrazena a vítěz předchozí výzvy dostane bod.)');
                    if (answer) saveChallenge();
                }, 800);
            }
        } catch (e) { console.error(e); }
    }

    // =============================================
    // ŽEBŘÍČEK
    // =============================================
    function listenLeaderboard() {
        if (leaderboardUnsubscribe) { leaderboardUnsubscribe(); leaderboardUnsubscribe = null; }

        // Použij aktuální todayPuzzleId — může být soutěžní, casual nebo challenge
        // Pro casual hru zobrazíme výsledky výzvy (pokud existuje), jinak dnešní soutěžní
        const difficulty = difficultySelect.value;
        const competitionPuzzleId = getTodayPuzzleId(difficulty);
        const leaderboardPuzzleId = isCasualMode ? competitionPuzzleId : todayPuzzleId;

        // Poznámka o módu
        if (isCasualMode) {
            leaderboardModeNote.textContent = '🎲 Hraješ mimo soutěž — tvůj výsledek se do žebříčku neuloží.';
            leaderboardModeNote.style.display = 'block';
        } else {
            leaderboardModeNote.textContent = '';
            leaderboardModeNote.style.display = 'none';
        }

        const q = query(
            collection(db, 'results'),
            where('puzzleId', '==', leaderboardPuzzleId),
            orderBy('seconds', 'asc')
        );

        leaderboardUnsubscribe = onSnapshot(q, async (snapshot) => {
            leaderboardList.innerHTML = '';

            // Tlačítko výzvy nahoře
            const challengeData = await loadChallenge();
            if (challengeData) {
                const challengeBtn = document.createElement('button');
                challengeBtn.className = 'challenge-btn';
                challengeBtn.innerHTML = `⚔️ Přijmout výzvu od <strong>${challengeData.createdBy}</strong>`;
                challengeBtn.addEventListener('click', () => acceptChallenge(challengeData));
                leaderboardList.appendChild(challengeBtn);
            }

            if (snapshot.empty) {
                const empty = document.createElement('p');
                empty.className = 'leaderboard-empty';
                empty.textContent = 'Zatím žádné výsledky. Buď první! 🚀';
                leaderboardList.appendChild(empty);
                return;
            }

            const medals = ['🥇', '🥈', '🥉'];
            const docs = snapshot.docs;

            // Načti skóre pro všechny hráče v žebříčku najednou
            const scorePromises = docs.map(d => getPlayerScore(d.data().nickname));
            const scores = await Promise.all(scorePromises);

            docs.forEach((docSnap, index) => {
                const data = docSnap.data();
                const m = String(Math.floor(data.seconds/60)).padStart(2,'0');
                const s = String(data.seconds%60).padStart(2,'0');
                const points = scores[index];
                const pointsBadge = points > 0 ? ` <span class="lb-points">⭐${points}</span>` : '';
                const row = document.createElement('div');
                row.classList.add('leaderboard-row');
                if (data.nickname === playerNickname) row.classList.add('leaderboard-me');
                row.innerHTML = `
                    <span class="lb-rank">${medals[index] || (index+1)+'.'}</span>
                    <span class="lb-name">${data.nickname}${pointsBadge}</span>
                    <span class="lb-time">${m}:${s}</span>
                `;
                leaderboardList.appendChild(row);
            });

            // Automaticky rozbal žebříček pokud je hráč v výsledcích
            const playerInResults = Array.from(snapshot.docs).some(d => d.data().nickname === playerNickname);
            if (playerInResults && leaderboardBody.style.display === 'none') {
                leaderboardBody.style.display = 'block';
                leaderboardToggleIcon.textContent = '▲';
            }
        });
    }

    function acceptChallenge(challengeData) {
        const answer = confirm(`Přijmout výzvu od hráče ${challengeData.createdBy}?\nBudeš hrát stejné sudoku jako on/ona.`);
        if (!answer) return;
        isChallengeMode = true;
        isCasualMode = false;
        challengeGrid = challengeData.grid;
        todayPuzzleId = challengeData.puzzleId;

        messageDisplay.textContent = '';
        if (selectedCell) { selectedCell.classList.remove('selected'); selectedCell = null; }
        activeNumber = null;
        clearNumberHighlights();

        initialGrid = challengeGrid.map(row => [...row]);
        solvedGrid  = solveSudoku(initialGrid.map(row => [...row]));
        currentGrid = initialGrid.map(row => [...row]);
        createNumberButtons();
        renderGrid(currentGrid);
        prepareGameUI();
        showMessage(`⚔️ Výzva přijata! Stiskni START až budeš připraven.`, 'info');
        listenLeaderboard();
    }

    // =============================================
    // NOVÁ HRA — SOUTĚŽNÍ
    // =============================================
    async function startCompetitionGame() {
        const difficulty = difficultySelect.value;
        const puzzleId = getTodayPuzzleId(difficulty);

        // Zkontroluj jestli hráč již má výsledek pro dnešní puzzle
        try {
            const q = query(collection(db, 'results'),
                where('puzzleId', '==', puzzleId),
                where('nickname', '==', playerNickname));
            const existing = await getDocs(q);
            if (!existing.empty) {
                // Hráč již hrál — zobraz zprávu a nabídni casual
                showMessage('⚠️ Dnešní soutěžní hru jsi již dokončil. Spouštím nové náhodné zadání...', 'info');
                setTimeout(() => startCasualGame(), 1500);
                return;
            }
        } catch (e) { console.error(e); }

        // Spusť soutěžní hru
        isCasualMode = false;
        isChallengeMode = false;
        messageDisplay.textContent = '';
        if (selectedCell) { selectedCell.classList.remove('selected'); selectedCell = null; }
        activeNumber = null;
        clearNumberHighlights();

        todayPuzzleId = puzzleId;
        puzzleSeed = hashCode(todayPuzzleId);

        initialGrid = generateSudokuWithSeed(difficulty, puzzleSeed);
        solvedGrid  = solveSudoku(initialGrid.map(row => [...row]));
        currentGrid = initialGrid.map(row => [...row]);
        createNumberButtons();
        renderGrid(currentGrid);
        prepareGameUI();
        listenLeaderboard();
        showMessage('🏆 Soutěžní hra — stiskni START až budeš připraven.', 'info');
    }

    // =============================================
    // NOVÁ HRA — MIMO SOUTĚŽ (CASUAL)
    // =============================================
    function startCasualGame() {
        isCasualMode = true;
        isChallengeMode = false;
        messageDisplay.textContent = '';
        if (selectedCell) { selectedCell.classList.remove('selected'); selectedCell = null; }
        activeNumber = null;
        clearNumberHighlights();

        const difficulty = difficultySelect.value;
        // Náhodný seed pro casual hru (jiný každý spuštění)
        casualSeed = Math.floor(Math.random() * 9999999);
        todayPuzzleId = `casual_${casualSeed}`;

        initialGrid = generateSudokuWithSeed(difficulty, casualSeed);
        solvedGrid  = solveSudoku(initialGrid.map(row => [...row]));
        currentGrid = initialGrid.map(row => [...row]);
        createNumberButtons();
        renderGrid(currentGrid);
        prepareGameUI();
        listenLeaderboard();
        showMessage('🎲 Hra mimo soutěž — stiskni START až budeš připraven.', 'info');
    }

    // --- Spuštění ---
    checkSolutionBtn.addEventListener('click', checkSolution);
    deleteNumbersBtn.addEventListener('click', handleDeleteClick);
    createNumberButtons();
    initNickname();
    if (localStorage.getItem('sudoku_nickname')) startCompetitionGame();
});
