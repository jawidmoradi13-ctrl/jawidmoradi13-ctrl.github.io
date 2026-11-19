const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const gridSize = 20;
const canvasSize = 400;

let snake = [{ x: 200, y: 200 }];
let food = { x: 0, y: 0 };
let dx = gridSize;
let dy = 0;
let score = 0;
let gameRunning = false;
let gamePaused = false;

function randomFood() {
    const x = Math.floor(Math.random() * (canvasSize / gridSize)) * gridSize;
    const y = Math.floor(Math.random() * (canvasSize / gridSize)) * gridSize;
    food = { x, y };
}

function drawGrid() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
}

function drawSnake() {
    ctx.fillStyle = '#4CAF50';
    snake.forEach((segment, index) => {
        if (index === 0) {
            ctx.fillStyle = '#66FF66';
        } else {
            ctx.fillStyle = '#4CAF50';
        }
        ctx.fillRect(segment.x, segment.y, gridSize - 2, gridSize - 2);
    });
}

function drawFood() {
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(food.x, food.y, gridSize - 2, gridSize - 2);
}

function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        randomFood();
    } else {
        snake.pop();
    }
    
    snake.unshift(head);
}

function checkCollision() {
    const head = snake[0];
    
    // Wände
    if (head.x < 0 || head.x >= canvasSize || head.y < 0 || head.y >= canvasSize) {
        gameOver();
        return;
    }
    
    // Eigenkollision
    for (let i = 4; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }
}

function gameOver() {
    gameRunning = false;
    gamePaused = false;
    alert('Game Over! Punkte: ' + score + '\n\nDrücke Leertaste zum Neustart');
    resetGame();
}

function resetGame() {
    snake = [{ x: 200, y: 200 }];
    dx = gridSize;
    dy = 0;
    score = 0;
    scoreElement.textContent = score;
    randomFood();
}

function gameLoop() {
    if (!gameRunning || gamePaused) return;
    
    moveSnake();
    checkCollision();
    drawGrid();
    drawSnake();
    drawFood();
}

function startGame() {
    if (!gameRunning) {
        gameRunning = true;
        gamePaused = false;
        resetGame();
    }
}

function togglePause() {
    if (gameRunning) {
        gamePaused = !gamePaused;
    } else {
        startGame();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        e.preventDefault();
        togglePause();
        return;
    }
    
    if (!gameRunning || gamePaused) return;
    
    if (e.key === 'ArrowUp' && dy !== gridSize) {
        dx = 0;
        dy = -gridSize;
    } else if (e.key === 'ArrowDown' && dy !== -gridSize) {
        dx = 0;
        dy = gridSize;
    } else if (e.key === 'ArrowLeft' && dx !== gridSize) {
        dx = -gridSize;
        dy = 0;
    } else if (e.key === 'ArrowRight' && dx !== -gridSize) {
        dx = gridSize;
        dy = 0;
    }
});

randomFood();
drawGrid();
drawSnake();
drawFood();

setInterval(gameLoop, 100);
