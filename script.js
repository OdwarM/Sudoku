document.addEventListener('DOMContentLoaded', () => {
    const sudokuGrid = document.getElementById('sudoku-grid');
    const newGameBtn = document.getElementById('new-game-btn');
    const checkSolutionBtn = document.getElementById('check-solution-btn');
    const messageDisplay = document.getElementById('message');

    let initialGrid = []; // Původní mřížka s předvyplněnými čísly
    let currentGrid = []; // Aktuální stav mřížky, včetně hráčem zadaných čísel
    let selectedCell = null; // Aktuálně vybraná buňka

    // Funkce pro generování prázdné 9x9 mřížky Sudoku
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

            // Kontrola řádku
            for (let col = 0; col < N; col++) {
                if (grid[r][col] === num && col !== c) return false;
            }

            // Kontrola sloupce
            for (let row = 0; row < N; row++) {
                if (grid[row][c] === num && row !== r) return false;
            }

            // Kontrola 3x3 bloku
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
            if (!emptyPos) return true; // Sudoku je vyřešeno

            const [r, c] = emptyPos;
            for (let num = 1; num <= 9; num++) {
                if (isValid(num, [r, c], grid)) {
                    grid[r][c] = num;
                    if (solve(grid)) return true;
                    grid[r][c] = 0; // Backtrack
                }
            }
            return false;
        };

        // Vytvoříme kopii mřížky, aby nedošlo k modifikaci originálu během řešení
        const solvedGrid = grid.map(row => [...row]);
        solve(solvedGrid);
        return solvedGrid;
    }

    // Funkce pro generování nové Sudoku hry (střední obtížnost)
    function generateSudoku() {
        let grid = generateEmptyGrid();

        // Vyplníme diagonální 3x3 bloky, aby bylo zajištěno, že má řešení
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

        // Nyní vyřešíme zbytek mřížky
        solveSudoku(grid); // Toto nám dá kompletně vyplněné a platné Sudoku

        // Odstraníme čísla pro vytvoření hádanky (obtížnost "střední")
        // Střední obtížnost: cca 40-50 skrytých čísel
        let cellsToRemove = 30; // Počet čísel, která se skryjí
        let cells = Array.from({length: 81}, (v, i) => i); // Pole indexů 0-80
        shuffleArray(cells);

        for (let i = 0; i < cellsToRemove; i++) {
            let r = Math.floor(cells[i] / 9);
            let c = cells[i] % 9;
            grid[r][c] = 0;
        }

        return grid;
    }

    // Pomocná funkce pro zamíchání pole (Fisher-Yates shuffle)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
    }

    // Funkce pro vykreslení Sudoku mřížky do HTML
    function renderGrid(grid) {
        sudokuGrid.innerHTML = ''; // Vyčistíme starou mřížku
        grid.forEach((row, rowIndex) => {
            row.forEach((num, colIndex) => {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if (initialGrid[rowIndex][colIndex] !== 0) {
                    cell.classList.add('fixed'); // Označení pevných čísel
                    cell.textContent = initialGrid[rowIndex][colIndex];
                } else {
                    cell.textContent = num !== 0 ? num : '';
                    cell.dataset.row = rowIndex;
                    cell.dataset.col = colIndex;
                    cell.addEventListener('click', handleCellClick);
                }

                // Přidáme třídy pro ohraničení 3x3 bloků
                if (rowIndex % 3 === 0 && rowIndex !== 0) {
                    cell.style.borderTopWidth = '2px';
                    cell.style.borderColor = '#333';
                }
                if (colIndex % 3 === 0 && colIndex !== 0) {
                    cell.style.borderLeftWidth = '2px';
                    cell.style.borderColor = '#333';
                }
                sudokuGrid.appendChild(cell);
            });
        });
    }

    // Handler pro kliknutí na buňku
    function handleCellClick(event) {
        if (selectedCell) {
            selectedCell.classList.remove('selected');
        }
        selectedCell = event.target;
        selectedCell.classList.add('selected');
        messageDisplay.textContent = ''; // Vymažeme zprávy
    }

    // Handler pro zadávání čísel z klávesnice
    document.addEventListener('keydown', (event) => {
        if (!selectedCell || selectedCell.classList.contains('fixed')) {
            return; // Nemůžeme zadávat do pevných buněk
        }

        const key = event.key;
        const row = parseInt(selectedCell.dataset.row);
        const col = parseInt(selectedCell.dataset.col);

        if (key >= '1' && key <= '9') {
            const num = parseInt(key);
            selectedCell.textContent = num;
            currentGrid[row][col] = num;
            selectedCell.classList.remove('invalid'); // Reset chybného stavu
            selectedCell.classList.add('player-input'); // Označení čísla zadaného hráčem
        } else if (key === 'Backspace' || key === 'Delete') {
            selectedCell.textContent = '';
            currentGrid[row][col] = 0;
            selectedCell.classList.remove('player-input', 'invalid');
        }
    });

    // Funkce pro kontrolu platnosti celého řešení
    function checkSolution() {
        // Vytvoříme kopii mřížky, abychom mohli zkontrolovat platnost bez trvalé změny
        const tempGrid = currentGrid.map(row => [...row]);
        const solvedInitialGrid = solveSudoku(initialGrid); // Řešení původní hádanky

        // Porovnáme aktuální mřížku hráče s řešením
        let isCorrect = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cellElement = sudokuGrid.children[r * 9 + c];
                cellElement.classList.remove('invalid', 'player-input'); // Reset stylů

                if (currentGrid[r][c] === 0) {
                    // Prázdné buňky jsou stále neúplné, nelze zkontrolovat jako vítězství
                    isCorrect = false;
                    continue;
                }

                if (currentGrid[r][c] !== solvedInitialGrid[r][c]) {
                    // Nesprávně zadané číslo
                    isCorrect = false;
                    if (!cellElement.classList.contains('fixed')) { // Zvýrazníme jen hráčem zadané špatné číslo
                        cellElement.classList.add('invalid');
                    }
                } else if (!cellElement.classList.contains('fixed')) {
                    // Správně zadané číslo hráčem
                    cellElement.classList.add('player-input');
                }
            }
        }

        if (isCorrect) {
            messageDisplay.textContent = 'Gratulujeme! Sudoku je správně vyřešeno!';
            messageDisplay.style.color = '#28a745'; // Zelená
        } else {
            messageDisplay.textContent = 'Řešení není správné. Zkontrolujte zvýrazněné buňky.';
            messageDisplay.style.color = '#dc3545'; // Červená
        }
    }


    // Inicializace nové hry
    function startNewGame() {
        messageDisplay.textContent = '';
        if (selectedCell) {
            selectedCell.classList.remove('selected');
            selectedCell = null;
        }

        initialGrid = generateSudoku();
        currentGrid = initialGrid.map(row => [...row]); // Kopie pro aktuální hru
        renderGrid(currentGrid);
    }

    // Přidání event listenerů pro tlačítka
    newGameBtn.addEventListener('click', startNewGame);
    checkSolutionBtn.addEventListener('click', checkSolution);

    // Spustit hru při načtení stránky
    startNewGame();
});