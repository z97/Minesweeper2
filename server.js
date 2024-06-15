const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const games = {};

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('createGame', () => {
        const gameId = Math.random().toString(36).substring(2, 10);
        games[gameId] = { players: [socket.id], board: createBoard(), turn: 1, gameOver: false };
        socket.join(gameId);
        socket.emit('gameCreated', { gameId });
    });

    socket.on('joinGame', (gameId) => {
        if (games[gameId] && games[gameId].players.length < 2) {
            games[gameId].players.push(socket.id);
            socket.join(gameId);
            io.to(gameId).emit('startGame', games[gameId].board);
        } else {
            socket.emit('error', 'Game not found or already full');
        }
    });

    socket.on('move', ({ gameId, row, col, player }) => {
        const game = games[gameId];
        if (game && game.players[player - 1] === socket.id && game.turn === player && !game.gameOver) {
            const cell = game.board[row][col];
            if (!cell.revealed && !cell.flagged) {
                cell.revealed = true;
                io.to(gameId).emit('move', { row, col, player, cell });

                if (cell.mine) {
                    game.gameOver = true;
                    io.to(gameId).emit('gameOver', `Player ${player} hit a mine. Player ${3 - player} wins!`);
                } else {
                    game.turn = 3 - player; // Switch turn
                    io.to(gameId).emit('switchTurn', { currentPlayer: game.turn });
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        for (const [gameId, game] of Object.entries(games)) {
            if (game.players.includes(socket.id)) {
                delete games[gameId];
                io.to(gameId).emit('gameOver', 'Player disconnected. Game over.');
            }
        }
    });
});

function createBoard() {
    const boardSize = 10;
    const mineCount = 20;
    const board = Array.from({ length: boardSize }, () =>
        Array.from({ length: boardSize }, () => ({
            mine: false,
            revealed: false,
            flagged: false,
            neighborCount: 0
        }))
    );

    let minesPlaced = 0;
    while (minesPlaced < mineCount) {
        const row = Math.floor(Math.random() * boardSize);
        const col = Math.floor(Math.random() * boardSize);
        if (!board[row][col].mine) {
            board[row][col].mine = true;
            minesPlaced++;
        }
    }

    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],         [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col].mine) continue;
            let count = 0;
            for (let [dx, dy] of directions) {
                const newRow = row + dx;
                const newCol = col + dy;
                if (newRow >= 0 && newRow < boardSize && newCol >= 0 && newCol < boardSize && board[newRow][newCol].mine) {
                    count++;
                }
            }
            board[row][col].neighborCount = count;
        }
    }

    return board;
}

server.listen(4000, () => console.log('Server is running on port 4000'));
