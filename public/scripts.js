document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const boardElement = document.getElementById('minesweeper-board');
    const createGameButton = document.getElementById('create-game-button');
    const joinGameButton = document.getElementById('join-game-button');
    const gameIdInput = document.getElementById('game-id-input');
    const currentPlayerElement = document.getElementById('current-player');

    let gameId;
    let playerNumber;
    let gameBoard;
    let myTurn = false;

    createGameButton.addEventListener('click', () => {
        socket.emit('createGame');
    });

    joinGameButton.addEventListener('click', () => {
        gameId = gameIdInput.value;
        socket.emit('joinGame', gameId);
    });

    socket.on('gameCreated', (data) => {
        gameId = data.gameId;
        playerNumber = 1;
        myTurn = true;
        currentPlayerElement.textContent = `Waiting for Player 2... Game ID: ${gameId}`;
    });

    socket.on('startGame', (board) => {
        gameBoard = board;
        renderBoard();
        if (playerNumber === 1) {
            myTurn = true;
            currentPlayerElement.textContent = `Your Turn (Player 1)`;
        } else {
            playerNumber = 2;
            myTurn = false;
            currentPlayerElement.textContent = `Opponent's Turn (Player 1)`;
        }
    });

    socket.on('move', ({ row, col, player }) => {
        handleMove(row, col, player);
        if (player !== playerNumber) {
            myTurn = true;
            currentPlayerElement.textContent = `Your Turn (Player ${playerNumber})`;
        } else {
            myTurn = false;
            currentPlayerElement.textContent = `Opponent's Turn (Player ${3 - playerNumber})`;
        }
        renderBoard(); // Re-render the board to reflect the move and update the disabled state
    });

    socket.on('gameOver', (message) => {
        currentPlayerElement.textContent = message;
        myTurn = false; // Ensure no further moves can be made
        renderBoard(); // Re-render the board to disable it
    });

    socket.on('switchTurn', ({ currentPlayer }) => {
        if (currentPlayer === playerNumber) {
            myTurn = true;
            currentPlayerElement.textContent = `Your Turn (Player ${playerNumber})`;
        } else {
            myTurn = false;
            currentPlayerElement.textContent = `Opponent's Turn (Player ${3 - playerNumber})`;
        }
        renderBoard(); // Re-render the board to update the disabled state
    });

    function renderBoard() {
        boardElement.innerHTML = '';
        for (let row = 0; row < gameBoard.length; row++) {
            for (let col = 0; col < gameBoard[row].length; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Disable the board for the player whose turn it is not
                if (!myTurn) {
                    cell.classList.add('disabled');
                }

                cell.addEventListener('click', () => {
                    if (myTurn && !gameBoard[row][col].revealed && !gameBoard[row][col].flagged) {
                        socket.emit('move', { gameId, row, col, player: playerNumber });
                        myTurn = false;
                        currentPlayerElement.textContent = `Opponent's Turn (Player ${3 - playerNumber})`;
                        renderBoard(); // Re-render the board to update the disabled state
                    }
                });

                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (myTurn && !gameBoard[row][col].revealed) {
                        gameBoard[row][col].flagged = !gameBoard[row][col].flagged;
                        renderBoard();
                    }
                });

                if (gameBoard[row][col].revealed) {
                    cell.classList.add('revealed');
                    cell.textContent = gameBoard[row][col].mine ? '💣' : gameBoard[row][col].neighborCount || '';
                } else if (gameBoard[row][col].flagged) {
                    cell.textContent = '🚩';
                    cell.style.backgroundColor = 'yellow';
                }
                boardElement.appendChild(cell);
            }
        }
    }

    function handleMove(row, col, player) {
        const cell = gameBoard[row][col];
        const cellElement = boardElement.children[row * gameBoard.length + col];
        if (cell.mine) {
            cellElement.classList.add('mine');
            cellElement.textContent = '💣';
            gameBoard[row][col].revealed = true;
            socket.emit('gameOver', `Player ${player} hit a mine. Player ${3 - player} wins!`);
        } else {
            cellElement.classList.add('revealed');
            cellElement.textContent = cell.neighborCount || '';
            gameBoard[row][col].revealed = true; // Mark the cell as revealed
        }
    }
});
