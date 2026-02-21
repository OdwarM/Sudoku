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

    // --- STAV HRY ---
    let initialGrid    = [];
    let currentGrid    = [];
    let selectedCell   = null;
    let activeNumber   = null;
    let timerInterval  = null;
    let timerSeconds   = 0;
    let timerRunning   = false;
    let playerNickname = '';
    let todayPuzzleId  = '';
    let puzzleSeed     = 0;
    let isChallengeMode = false;   // Hrajeme výzvu (challenge)?
    let challengeGrid  = null;     // Mřížka výzvy načtená z Firebase
    let leaderboardUnsubscribe = null; // Pro odpojení listeneru

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
        startNewGame();
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
        if (btn) btn.classList.add('active');
    }

    function showMessage(text, type = 'info') {
        messageDisplay.textContent = text;
        messageDisplay.style.color = type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#333');
    }

    // Spočítá kolik je v currentGrid číslo num (včetně fixed)
    function countNumberInGrid(num) {
        let count = 0;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (currentGrid[r][c] === num) count++;
        return count;
    }

    // Zkontroluje jestli je číslo správně umístěno ve všech 9 políčcích
    function checkNumberComplete(num) {
        if (countNumberInGrid(num) < 9) return; // Ještě není 9 výskytů

        const solved = solveSudoku(initialGrid);
        let allCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (currentGrid[r][c] === num && solved[r][c] !== num) {
                    allCorrect = false;
                    // Označ špatně zadané buňky červeně
                    if (initialGrid[r][c] === 0) {
                        sudokuGrid.children[r * 9 + c].classList.add('invalid');
                    }
                }
            }
        }

        if (allCorrect) {
            // Zašedni tlačítko tohoto čísla
            const btn = document.querySelector(`.number-btn[data-number="${num}"]`);
            if (btn) {
                btn.classList.add('completed');
                btn.disabled = true;
            }
            // Pokud bylo toto číslo aktivní, deaktivuj ho
            if (activeNumber === num) {
                activeNumber = null;
                clearNumberHighlights();
            }
        }
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

    // Klik na buňku = POUZE výběr, číslo se NEZAPÍŠE
    function handleCellClick(event) {
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
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        selectedCell.textContent = num;
        currentGrid[row][col] = num;
        selectedCell.classList.remove('invalid');
        selectedCell.classList.add('player-input');
        playSound();
        highlightSameNumbers(num);
        checkNumberComplete(num); // Zkontroluj jestli je číslo kompletní
    }

    function createNumberButtons() {
        numberButtonsContainer.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const button = document.createElement('div');
            button.classList.add('number-btn');
            button.textContent = i;
            button.dataset.number = i;
            button.addEventListener('click', handleNumberButtonClick);
            numberButtonsContainer.appendChild(button);
        }
    }

    // Klik na číselné tlačítko:
    // - Pokud je buňka vybrána → okamžitě zapíše číslo (bez ohledu na activeNumber)
    // - Pokud buňka není vybrána → pouze nastaví activeNumber jako štětec
    function handleNumberButtonClick(event) {
        if (event.target.disabled) return;
        const num = parseInt(event.target.dataset.number);

        if (selectedCell && !selectedCell.classList.contains('fixed')) {
            // Vždy zapiš číslo do vybrané buňky
            activeNumber = num;
            writeNumberToCell(num);
        } else {
            // Přepínání štětce (žádná buňka není vybrána)
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
        if (selectedCell.classList.contains('fixed')) { showMessage('Nelze mazat původní číslo.', 'error'); return; }
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        currentGrid[row][col] = 0;
        selectedCell.textContent = '';
        selectedCell.classList.remove('player-input', 'invalid');
        clearNumberHighlights();
        activeNumber = null;
        playSound();
        showMessage('Číslo bylo smazáno.', 'info');
    }

    document.addEventListener('keydown', (event) => {
        if (!selectedCell || selectedCell.classList.contains('fixed')) return;
        const key = event.key;
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        if (key >= '1' && key <= '9') {
            const num = parseInt(key);
            activeNumber = num;
            writeNumberToCell(num);
        } else if (key === 'Backspace' || key === 'Delete') {
            currentGrid[row][col] = 0;
            selectedCell.textContent = '';
            selectedCell.classList.remove('player-input', 'invalid');
            activeNumber = null;
            clearNumberHighlights();
            playSound();
        }
    });

    // =============================================
    // KONTROLA ŘEŠENÍ + ULOŽENÍ DO FIREBASE
    // =============================================
    function checkSolution() {
        const solved = solveSudoku(initialGrid);
        let isCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cellElement = sudokuGrid.children[r * 9 + c];
                cellElement.classList.remove('invalid');
                if (currentGrid[r][c] === 0) { isCorrect = false; continue; }
                if (currentGrid[r][c] !== solved[r][c]) {
                    isCorrect = false;
                    if (!cellElement.classList.contains('fixed')) cellElement.classList.add('invalid');
                }
            }
        }
        if (isCorrect) {
            stopTimer();
            timerDisplay.classList.add('finished');
            const m = String(Math.floor(timerSeconds/60)).padStart(2,'0');
            const s = String(timerSeconds%60).padStart(2,'0');
            showMessage(`🎉 Gratulujeme! Vyřešeno za ${m}:${s}!`, 'success');
            saveResultToFirebase(timerSeconds);
            // Po vyřešení nabídni uložení jako výzvu (pokud jsou v žebříčku ≥2 hráči)
            checkOfferSaveChallenge();
        } else {
            showMessage('Zkontrolujte zvýrazněné (červené) buňky.', 'error');
        }
    }

    async function saveResultToFirebase(seconds) {
        try {
            await addDoc(collection(db, 'results'), {
                puzzleId: todayPuzzleId,
                nickname: playerNickname,
                seconds: seconds,
                timestamp: new Date()
            });
        } catch (e) { console.error('Chyba při ukládání výsledku:', e); }
    }

    // =============================================
    // VÝZVA (CHALLENGE)
    // =============================================

    // Načte aktuální výzvu z Firebase
    async function loadChallenge() {
        try {
            const challengeDoc = await getDoc(doc(db, 'challenge', 'current'));
            return challengeDoc.exists() ? challengeDoc.data() : null;
        } catch (e) { console.error('Chyba při načítání výzvy:', e); return null; }
    }

    // Uloží aktuální hru jako výzvu
    async function saveChallenge() {
        try {
            await setDoc(doc(db, 'challenge', 'current'), {
                puzzleId: todayPuzzleId,
                grid: initialGrid.map(row => [...row]),
                difficulty: difficultySelect.value,
                createdBy: playerNickname,
                createdAt: new Date()
            });
            showMessage('✅ Hra uložena jako výzva pro ostatní hráče!', 'success');
        } catch (e) { console.error('Chyba při ukládání výzvy:', e); }
    }

    // Po dokončení hry zkontroluje, jestli jsou ≥2 hráči v žebříčku → nabídne uložení výzvy
    async function checkOfferSaveChallenge() {
        try {
            const q = query(collection(db, 'results'), where('puzzleId', '==', todayPuzzleId));
            const snap = await getDocs(q);
            if (snap.size >= 2) {
                setTimeout(() => {
                    const answer = confirm('Uložit tuto hru jako novou výzvu pro ostatní hráče?\n(Původní výzva bude nahrazena.)');
                    if (answer) saveChallenge();
                }, 800);
            }
        } catch (e) { console.error(e); }
    }

    // =============================================
    // ŽEBŘÍČEK
    // =============================================
    function listenLeaderboard() {
        // Odpoj předchozí listener
        if (leaderboardUnsubscribe) { leaderboardUnsubscribe(); leaderboardUnsubscribe = null; }

        const q = query(
            collection(db, 'results'),
            where('puzzleId', '==', todayPuzzleId),
            orderBy('seconds', 'asc')
        );

        leaderboardUnsubscribe = onSnapshot(q, async (snapshot) => {
            leaderboardList.innerHTML = '';

            // Tlačítko výzvy — zobraz vždy nahoře
            const challengeData = await loadChallenge();
            if (challengeData) {
                const challengeBtn = document.createElement('button');
                challengeBtn.id = 'accept-challenge-btn';
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
            snapshot.forEach((docSnap, index) => {
                const data = docSnap.data();
                const m = String(Math.floor(data.seconds/60)).padStart(2,'0');
                const s = String(data.seconds%60).padStart(2,'0');
                const row = document.createElement('div');
                row.classList.add('leaderboard-row');
                if (data.nickname === playerNickname) row.classList.add('leaderboard-me');
                row.innerHTML = `
                    <span class="lb-rank">${medals[index] || (index+1)+'.'}  </span>
                    <span class="lb-name">${data.nickname}</span>
                    <span class="lb-time">${m}:${s}</span>
                `;
                leaderboardList.appendChild(row);
            });
        });
    }

    // Přijme výzvu — načte uloženou mřížku a spustí hru s ní
    function acceptChallenge(challengeData) {
        const answer = confirm(`Přijmout výzvu od hráče ${challengeData.createdBy}?\nBudeš hrát stejné sudoku jako on/ona.`);
        if (!answer) return;
        isChallengeMode = true;
        challengeGrid = challengeData.grid;
        todayPuzzleId = challengeData.puzzleId;

        messageDisplay.textContent = '';
        if (selectedCell) { selectedCell.classList.remove('selected'); selectedCell = null; }
        activeNumber = null;
        clearNumberHighlights();

        initialGrid = challengeGrid.map(row => [...row]);
        currentGrid = initialGrid.map(row => [...row]);
        renderGrid(currentGrid);
        startTimer();
        createNumberButtons(); // Reset tlačítek (odstraní completed stav)
        showMessage(`⚔️ Výzva přijata! Hraje stejné puzzle jako ${challengeData.createdBy}.`, 'info');
        listenLeaderboard();
    }

    // =============================================
    // NOVÁ HRA
    // =============================================
    function startNewGame() {
        messageDisplay.textContent = '';
        if (selectedCell) { selectedCell.classList.remove('selected'); selectedCell = null; }
        activeNumber = null;
        isChallengeMode = false;
        challengeGrid = null;
        clearNumberHighlights();

        const difficulty = difficultySelect.value;
        todayPuzzleId = getTodayPuzzleId(difficulty);
        puzzleSeed = hashCode(todayPuzzleId);

        initialGrid = generateSudokuWithSeed(difficulty, puzzleSeed);
        currentGrid = initialGrid.map(row => [...row]);
        renderGrid(currentGrid);
        startTimer();
        createNumberButtons(); // Reset tlačítek
        listenLeaderboard();
    }

    // --- Spuštění ---
    newGameBtn.addEventListener('click', startNewGame);
    checkSolutionBtn.addEventListener('click', checkSolution);
    difficultySelect.addEventListener('change', startNewGame);
    deleteNumbersBtn.addEventListener('click', handleDeleteClick);
    createNumberButtons();
    initNickname();
    if (localStorage.getItem('sudoku_nickname')) startNewGame();
});

