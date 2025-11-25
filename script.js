document.addEventListener('DOMContentLoaded', () => {
    const sudokuGrid = document.getElementById('sudoku-grid');
    const newGameBtn = document.getElementById('new-game-btn');
    const checkSolutionBtn = document.getElementById('check-solution-btn');
    const messageDisplay = document.getElementById('message');
    const difficultySelect = document.getElementById('difficulty');
    const numberButtonsContainer = document.getElementById('number-buttons');
    
    // NOVÉ: Deklarace tlačítka pro mazání
    const deleteNumbersBtn = document.getElementById('delete-numbers'); 

    let initialGrid = [];
    let currentGrid = [];
    let selectedCell = null;
    let activeNumber = null; // Číslo vybrané jako "štětec"

    const DIFFICULTY_MAP = {
        'easy': 40,
        'medium': 50,
        'hard': 60
    };
    

    // --- FUNKCE PRO LOGIKU SUDOKU ---

    function generateEmptyGrid() {
        return Array(9).fill(null).map(() => Array(9).fill(0));
    }
    
    // Funkce pro řešení Sudoku pomocí backtracking algoritmu
    function solveSudoku(grid) {
        const N = 9;
        const findEmpty = (grid) => {
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    if (grid[r][c] === 0) return [r, c];
                }
            }
            return null;
        };

        const isValid = (num, pos, grid) => {
            const [r, c] = pos;
            for (let col = 0; col < N; col++) { if (grid[r][col] === num && col !== c) return false; }
            for (let row = 0; row < N; row++) { if (grid[row][c] === num && row !== r) return false; }
            const boxRow = Math.floor(r / 3) * 3;
            const boxCol = Math.floor(c / 3) * 3;
            for (let row = boxRow; row < boxRow + 3; row++) {
                for (let col = boxCol; col < boxCol + 3; col++) {
                    if (grid[row][col] === num && (row !== r || col !== c)) return false;
                }
            }
            return true;
        };

        const solve = (grid) => {
            const emptyPos = findEmpty(grid);
            if (!emptyPos) return true;
            const [r, c] = emptyPos;
            for (let num = 1; num <= 9; num++) {
                if (isValid(num, [r, c], grid)) {
                    grid[r][c] = num;
                    if (solve(grid)) return true;
                    grid[r][c] = 0;
                }
            }
            return false;
        };
        const solvedGrid = grid.map(row => [...row]);
        solve(solvedGrid);
        return solvedGrid;
    }


    // Funkce pro generování nové Sudoku hry s ohledem na obtížnost
    function generateSudoku(difficulty) {
        let grid = generateEmptyGrid();

        function fillBox(grid, row, col) {
            let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            shuffleArray(nums);
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    grid[row + r][col + c] = nums.pop();
                }
            }
        }

        // KROK 1: Vyplníme diagonální 3x3 bloky
        fillBox(grid, 0, 0);
        fillBox(grid, 3, 3);
        fillBox(grid, 6, 6);

        // KROK 2: Dokončíme CELOU mřížku pomocí solveSudoku
        grid = solveSudoku(grid);
        
        if (!grid || grid[0][0] === 0) {
              // Pokud se nepodařilo vyřešit, zkusíme znovu
              return generateSudoku(difficulty); 
        }

        // KROK 3: Odstraníme čísla na základě obtížnosti
        const cellsToRemove = DIFFICULTY_MAP[difficulty];
        let cells = Array.from({length: 81}, (v, i) => i);
        shuffleArray(cells);
        
        // Vytvoříme mřížku pro hru (hádanku) odstraněním čísel
        for (let i = 0; i < cellsToRemove; i++) {
            let r = Math.floor(cells[i] / 9);
            let c = cells[i] % 9;
            grid[r][c] = 0;
        }

        return grid;
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- POMOCNÉ FUNKCE PRO VIZUÁL A INTERAKCI ---
    
    // Funkce pro spolehlivé spuštění zvuku (vytvoří novou instanci)
    function playSound() {
        const sound = new Audio('./sound/click.wav'); 
        sound.play().catch(e => console.error("Zvuk se nepodařilo spustit:", e));
    }
    
    // NOVÉ: Funkce pro vyčištění všech zvýraznění
    function clearNumberHighlights() {
        const allCells = document.querySelectorAll('.cell');
        allCells.forEach(cell => {
            cell.classList.remove('highlighted');
        });
        // Zruší zvýraznění i na tlačítkách 1-9
        document.querySelectorAll('.number-btn').forEach(btn => btn.classList.remove('active'));
    }

    // Funkce pro zvýraznění všech stejných čísel
    function highlightSameNumbers(num) {
        // Nejprve odstraníme všechna zvýraznění z mřížky a tlačítek
        clearNumberHighlights(); 

        if (num === 0 || num === null) return; // Nic k zvýraznění

        const cells = document.querySelectorAll('.cell');

        // Zvýrazníme buňky s daným číslem
        cells.forEach(cell => {
            if (parseInt(cell.textContent) === num) {
                cell.classList.add('highlighted');
            }
        });

        // Zvýrazníme aktivní tlačítko
        const activeBtn = document.querySelector(`.number-btn[data-number="${num}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    function showMessage(text, type = 'info') {
        messageDisplay.textContent = text;
        messageDisplay.style.color = type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#333');
    }

    // --- FUNKCE PRO VYKRESLENÍ A HANDLERY ---

    // Funkce pro vykreslení Sudoku mřížky do HTML
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
                    cell.addEventListener('click', handleCellClick); 
                } else {
                    cell.textContent = num !== 0 ? num : '';
                    cell.addEventListener('click', handleCellClick);
                    // PŘIDÁNO: Pokud je číslo zadané hráčem, přidáme třídu
                    if (num !== 0) {
                        cell.classList.add('player-input');
                    }
                }
                
                sudokuGrid.appendChild(cell);
            });
        });
        highlightSameNumbers(activeNumber); 
    }

    // Handler pro kliknutí na buňku (ZÁPIS NEBO VÝBĚR)
    function handleCellClick(event) {
        const targetCell = event.target;
        messageDisplay.textContent = ''; // Vymažeme zprávy

        // 1. Logika výběru buňky
        const isFixed = targetCell.classList.contains('fixed');
        if (selectedCell) {
            selectedCell.classList.remove('selected');
        }

        selectedCell = targetCell;
        selectedCell.classList.add('selected');

        // 2. Zadávání čísla, POUZE pokud je aktivní "štětec" a buňka není pevná
        if (!isFixed && activeNumber !== null) {
            const row = parseInt(selectedCell.dataset.row);
            const col = parseInt(selectedCell.dataset.col);
            
            // Zápis čísla
            selectedCell.textContent = activeNumber;
            currentGrid[row][col] = activeNumber;
            
            // ZVUKOVÁ ODEZVA - POUZE při úspěšném vložení
            playSound(); 
            
            selectedCell.classList.remove('invalid');
            selectedCell.classList.add('player-input');

            // Aktualizujeme zvýraznění po vložení čísla
            highlightSameNumbers(activeNumber);
            
        } 
        
        // 3. Logika zvýraznění: Pouze zvýrazní čísla v mřížce (pokud existují) nebo aktivní číslo (štětec)
        const cellValue = parseInt(targetCell.textContent);
        if (cellValue >= 1 && cellValue <= 9) {
            highlightSameNumbers(cellValue); // Zvýrazníme číslo v buňce
        } else {
            // Pokud je prázdná, zvýrazníme aktivní číslo ze štětce
            highlightSameNumbers(activeNumber);
        }
    }
    
    // Generování tlačítek 1-9
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

    // Handler pro kliknutí na číselné tlačítko (VÝBĚR ŠTĚTCE)
    function handleNumberButtonClick(event) {
        const num = parseInt(event.target.dataset.number);

        // Deaktivace/Aktivace "štětec" módu
        if (activeNumber === num) {
            activeNumber = null; // Zrušení aktivního čísla
        } else {
            activeNumber = num; // Nastavení nového aktivního čísla
        }
        
        // Zvýrazníme číslo v mřížce a aktivní tlačítko
        highlightSameNumbers(activeNumber); 
        
        // ZVUKOVÁ ODEZVA - POUZE při výběru/změně štětce
        if (activeNumber !== null) {
            playSound();
        }
        
        // *** DŮLEŽITÉ: Zápis do selectedCell zde byl odstraněn. Nyní se provádí v handleCellClick. ***
    }

    // NOVÉ: Funkce pro smazání čísla po kliknutí na tlačítko
    function handleDeleteClick() {
        // 1. Zkontrolujeme, zda je nějaká buňka vybrána
        if (!selectedCell) {
            showMessage('Nejprve vyberte políčko pro smazání.', 'error');
            return; 
        }

        // 2. Zkontrolujeme, zda buňka není původní zadané číslo (fixed)
        if (selectedCell.classList.contains('fixed')) {
            showMessage('Nelze mazat původní číslo zadané hrou.', 'error');
            return;
        }

        // 3. Provedeme mazání v herní logice (datový model)
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);

        // Nastavíme hodnotu v herní logice na 0 (prázdné)
        currentGrid[row][col] = 0; 

        // 4. Aktualizujeme vizuální zobrazení buňky
        selectedCell.textContent = '';
        
        // Odstraníme všechny vizuální stavy
        selectedCell.classList.remove('player-input', 'invalid'); 
        
        // 5. Zrušíme zvýraznění aktivního čísla (pokud číslo, které jsme smazali, bylo aktivní)
        clearNumberHighlights(); 
        activeNumber = null; // Zrušíme i štětec
        
        playSound(); // Zvuková odezva pro smazání
        showMessage('Číslo bylo smazáno.', 'info');
    }
    
// Handler pro zadávání čísel z klávesnice (CHYPOVÉ ZADÁNÍ)
    document.addEventListener('keydown', (event) => {
        if (!selectedCell || selectedCell.classList.contains('fixed')) {
            return;
        }

        const key = event.key;
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        
        // Chceme, aby se zadání z klávesnice chovalo jako přímý zápis a rušilo štětec
        activeNumber = null;
        clearNumberHighlights(); // Zruší zvýraznění štětce
        

        // Zápis z klávesnice
        if (key >= '1' && key <= '9') {
            const num = parseInt(key);
            selectedCell.textContent = num;
            currentGrid[row][col] = num;
            selectedCell.classList.remove('invalid');
            selectedCell.classList.add('player-input');
            
            playSound(); 
            highlightSameNumbers(num); // Zvýrazníme číslo, které jsme právě zadali
            
        } else if (key === 'Backspace' || key === 'Delete') {
            // Logika mazání z klávesnice
            selectedCell.textContent = '';
            currentGrid[row][col] = 0;
            selectedCell.classList.remove('player-input', 'invalid');
            
            playSound(); 
            highlightSameNumbers(null);
        }
    });

    // Kontrola platnosti celého řešení
    function checkSolution() {
        const solvedInitialGrid = solveSudoku(initialGrid);

        let isCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cellElement = sudokuGrid.children[r * 9 + c];
                cellElement.classList.remove('invalid'); 

                if (currentGrid[r][c] === 0) {
                    isCorrect = false;
                    continue;
                }

                if (currentGrid[r][c] !== solvedInitialGrid[r][c]) {
                    isCorrect = false;
                    if (!cellElement.classList.contains('fixed')) {
                        cellElement.classList.add('invalid');
                    }
                }
            }
        }

        if (isCorrect) {
            showMessage('Gratulujeme! Sudoku je správně vyřešeno!', 'success');
        } else {
            showMessage('Zkontrolujte zvýrazněné (červené) buňky.', 'error');
        }
    }


    // Inicializace nové hry
    function startNewGame() {
        messageDisplay.textContent = '';
        if (selectedCell) {
            selectedCell.classList.remove('selected');
            selectedCell = null;
        }
        activeNumber = null;
        clearNumberHighlights();
        
        const difficulty = difficultySelect.value;
        initialGrid = generateSudoku(difficulty);
        currentGrid = initialGrid.map(row => [...row]);
        renderGrid(currentGrid);
    }

    // --- Přidání event listenerů ---
    newGameBtn.addEventListener('click', startNewGame);
    checkSolutionBtn.addEventListener('click', checkSolution);
    difficultySelect.addEventListener('change', startNewGame);
    
    // NOVÉ: Přidání listeneru pro tlačítko mazání
    deleteNumbersBtn.addEventListener('click', handleDeleteClick);

    // Spustit hru při načtení stránky
    createNumberButtons();
    startNewGame();
});
