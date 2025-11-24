document.addEventListener('DOMContentLoaded', () => {
    const sudokuGrid = document.getElementById('sudoku-grid');
    const newGameBtn = document.getElementById('new-game-btn');
    const checkSolutionBtn = document.getElementById('check-solution-btn');
    const messageDisplay = document.getElementById('message');
    const difficultySelect = document.getElementById('difficulty');
    const numberButtonsContainer = document.getElementById('number-buttons');

    let initialGrid = [];
    let currentGrid = [];
    let selectedCell = null;
    let activeNumber = null; // NOVÉ: Aktivní číslo pro automatické zadávání

    // NOVÉ: Mapování obtížnosti na počet skrytých čísel
    const DIFFICULTY_MAP = {
        'easy': 40,
        'medium': 50,
        'hard': 60
    };

    // --- FUNKCE PRO LOGIKU SUDOKU (Neměněno) ---

    function generateEmptyGrid() {
        return Array(9).fill(null).map(() => Array(9).fill(0));
    }
    
    // ... solveSudoku, isValid (Logika pro řešení) zůstávají stejné ...

    // Funkce pro řešení Sudoku pomocí backtracking algoritmu (Zde ponecháno pro funkčnost, ale pro úsporu místa zkráceno - kód je stejný jako dříve)
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
        fillBox(grid, 0, 0);
        fillBox(grid, 3, 3);
        fillBox(grid, 6, 6);

        solveSudoku(grid); // Vyřešená mřížka

        // Odstraníme čísla na základě obtížnosti
        const cellsToRemove = DIFFICULTY_MAP[difficulty];
        let cells = Array.from({length: 81}, (v, i) => i);
        shuffleArray(cells);

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

    // --- RENDER A INTERAKCE ---

    // NOVÉ: Funkce pro zvýraznění všech stejných čísel
    function highlightSameNumbers(num) {
        const cells = document.querySelectorAll('.cell');
        // Nejprve odstraníme všechna zvýraznění
        cells.forEach(cell => cell.classList.remove('highlighted'));

        if (num === 0 || num === null) return; // Nic k zvýraznění

        // Zvýrazníme buňky s daným číslem
        cells.forEach(cell => {
            if (parseInt(cell.textContent) === num) {
                cell.classList.add('highlighted');
            }
        });

        // Zvýrazníme aktivní tlačítko
        document.querySelectorAll('.number-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.number-btn[data-number="${num}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }


    // Funkce pro vykreslení Sudoku mřížky do HTML
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
                    // PŘIDÁNO: I PEVNÉ BUŇKY POTŘEBUJÍ CLICK LISTENER PRO ZVÝRAZNĚNÍ
                    cell.addEventListener('click', handleCellClick); 
                } else {
                    cell.textContent = num !== 0 ? num : '';
                    cell.addEventListener('click', handleCellClick);
                }
                
                // ... (Zbytek renderGrid)
                sudokuGrid.appendChild(cell);
            });
        });
        // Při vykreslení mřížky aplikujeme zvýraznění aktivního čísla
        highlightSameNumbers(activeNumber); 
    }

    // Handler pro kliknutí na buňku
    function handleCellClick(event) {
        const targetCell = event.target;
        messageDisplay.textContent = ''; // Vymažeme zprávy

        // 1. Logika výběru buňky pro zadání čísla
        if (!targetCell.classList.contains('fixed')) {
             if (selectedCell) {
                selectedCell.classList.remove('selected');
            }
            selectedCell = targetCell;
            selectedCell.classList.add('selected');

            // Pokud máme aktivní číslo (štětec), vložíme ho
            if (activeNumber !== null) {
                const row = parseInt(selectedCell.dataset.row);
                const col = parseInt(selectedCell.dataset.col);
                
                selectedCell.textContent = activeNumber;
                currentGrid[row][col] = activeNumber;
                
                selectedCell.classList.remove('invalid');
                selectedCell.classList.add('player-input');

                // Aktualizujeme zvýraznění po vložení čísla
                highlightSameNumbers(activeNumber);
            }
        }

        // 2. Logika zvýraznění všech stejných čísel (z pevné nebo zadané buňky)
        const cellValue = parseInt(targetCell.textContent);
        if (cellValue >= 1 && cellValue <= 9) {
            activeNumber = cellValue;
            highlightSameNumbers(activeNumber);
        } else if (targetCell.classList.contains('selected') && targetCell.textContent === '') {
            // Kliknuto na prázdnou buňku, deaktivujeme štětec a zvýraznění
            activeNumber = null;
            highlightSameNumbers(null);
        }
    }
    
    // NOVÉ: Generování tlačítek 1-9
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

    // NOVÉ: Handler pro kliknutí na číselné tlačítko
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
    }
    
    // Handler pro zadávání čísel z klávesnice (Upraveno pro interakci se zvýrazněním)
    document.addEventListener('keydown', (event) => {
        if (!selectedCell || selectedCell.classList.contains('fixed')) {
            return;
        }

        const key = event.key;
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);
        
        // Deaktivujeme aktivní číslo (štětec), pokud se zadává z klávesnice
        activeNumber = null;
        highlightSameNumbers(null);

        if (key >= '1' && key <= '9') {
            const num = parseInt(key);
            selectedCell.textContent = num;
            currentGrid[row][col] = num;
            selectedCell.classList.remove('invalid');
            selectedCell.classList.add('player-input');
        } else if (key === 'Backspace' || key === 'Delete') {
            selectedCell.textContent = '';
            currentGrid[row][col] = 0;
            selectedCell.classList.remove('player-input', 'invalid');
        }
    });

    // Kontrola platnosti celého řešení (Beze změny)
    function checkSolution() {
        // ... Logika kontroly vítězství je stejná jako dříve ...
        const tempGrid = currentGrid.map(row => [...row]);
        const solvedInitialGrid = solveSudoku(initialGrid);

        let isCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cellElement = sudokuGrid.children[r * 9 + c];
                cellElement.classList.remove('invalid', 'player-input'); 

                if (currentGrid[r][c] === 0) {
                    isCorrect = false;
                    continue;
                }

                if (currentGrid[r][c] !== solvedInitialGrid[r][c]) {
                    isCorrect = false;
                    if (!cellElement.classList.contains('fixed')) {
                        cellElement.classList.add('invalid');
                    }
                } else if (!cellElement.classList.contains('fixed')) {
                    cellElement.classList.add('player-input');
                }
            }
        }

        if (isCorrect) {
            messageDisplay.textContent = 'Gratulujeme! Sudoku je správně vyřešeno!';
            messageDisplay.style.color = '#28a745';
        } else {
            messageDisplay.textContent = 'Řešení není správné. Zkontrolujte zvýrazněné buňky.';
            messageDisplay.style.color = '#dc3545';
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
        
        const difficulty = difficultySelect.value;
        initialGrid = generateSudoku(difficulty);
        currentGrid = initialGrid.map(row => [...row]);
        renderGrid(currentGrid);
    }

    // Přidání event listenerů
    newGameBtn.addEventListener('click', startNewGame);
    checkSolutionBtn.addEventListener('click', checkSolution);
    difficultySelect.addEventListener('change', startNewGame); // Spustit novou hru při změně obtížnosti

    // Spustit hru při načtení stránky
    createNumberButtons();
    startNewGame();
});
