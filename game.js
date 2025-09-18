class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('overlay');
        
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.highScore = parseInt(localStorage.getItem('blockBreakerHighScore')) || 0;
        
        this.paddle = {
            x: this.canvas.width / 2 - 80,
            y: this.canvas.height - 45,
            width: 130,
            height: 15,
            speed: 8,
            normalWidth: 120
        };
        
        this.ball = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            radius: 8,
            dx: 4,
            dy: -4,
            baseSpeed: 4
        };
        
        this.balls = [this.ball];
        this.bricks = [];
        this.powerups = [];
        this.particles = [];
        
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.gameState = 'playing';
        this.powerupTimer = 0;
        
        this.brickTypes = {
            normal: { hits: 1, color: '#4299e1', points: 10 },
            strong: { hits: 2, color: '#9f7aea', points: 20 },
            unbreakable: { hits: Infinity, color: '#a0aec0', points: 0 }
        };
        
        this.powerupTypes = {
            bigPaddle: { color: '#48bb78', duration: 10000 },
            multiBall: { color: '#4299e1' },
            extraLife: { color: '#f56565' }
        };
        
        this.init();
        this.gameLoop();
    }
    
    init() {
        this.setupEventListeners();
        this.createLevel();
        this.updateUI();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.keys[e.key] = true);
        document.addEventListener('keyup', (e) => this.keys[e.key] = false);
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && this.gameState !== 'playing') {
                this.restart();
            }
        });
    }
    
    createLevel() {
        this.bricks = [];
        const patterns = [
            () => {
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 10; c++) {
                        this.addBrick(c, r, 'normal');
                    }
                }
            },
            () => {
                for (let r = 0; r < 6; r++) {
                    for (let c = 0; c < 10; c++) {
                        const type = r < 2 ? 'strong' : 'normal';
                        this.addBrick(c, r, type);
                    }
                }
            },
            () => {
                for (let r = 0; r < 7; r++) {
                    for (let c = 0; c < 10; c++) {
                        let type = 'normal';
                        if (r === 3 && (c === 2 || c === 7)) type = 'unbreakable';
                        else if (r < 3) type = 'strong';
                        this.addBrick(c, r, type);
                    }
                }
            },
            () => {
                const rows = Math.min(8, 5 + this.level - 4);
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < 10; c++) {
                        let type = 'normal';
                        if (Math.random() < 0.1) type = 'unbreakable';
                        else if (Math.random() < 0.3) type = 'strong';
                        this.addBrick(c, r, type);
                    }
                }
            }
        ];
        
        const patternIndex = Math.min(this.level - 1, patterns.length - 1);
        patterns[patternIndex]();
        
        const speedMultiplier = 1 + (this.level - 1) * 0.1;
        this.balls.forEach(ball => {
            const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
            const newSpeed = ball.baseSpeed * speedMultiplier;
            ball.dx = (ball.dx / currentSpeed) * newSpeed;
            ball.dy = (ball.dy / currentSpeed) * newSpeed;
        });
    }
    
    addBrick(col, row, type) {
        const brick = {
            x: col * 80 + 10,
            y: row * 30 + 50,
            width: 75,
            height: 25,
            type: type,
            hits: this.brickTypes[type].hits,
            maxHits: this.brickTypes[type].hits,
            color: this.brickTypes[type].color
        };
        this.bricks.push(brick);
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        this.updatePaddle();
        this.updateBalls();
        this.updatePowerups();
        this.updateParticles();
        this.checkCollisions();
        this.checkWinLose();
        this.updatePowerupTimer();
    }
    
    updatePaddle() {
        if (this.keys['ArrowLeft'] || this.keys['a']) {
            this.paddle.x -= this.paddle.speed;
        }
        if (this.keys['ArrowRight'] || this.keys['d']) {
            this.paddle.x += this.paddle.speed;
        }
        
        if (this.mouse.x > 0) {
            this.paddle.x = this.mouse.x - this.paddle.width / 2;
        }
        
        this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.x));
    }
    
    updateBalls() {
        this.balls.forEach((ball, index) => {
            ball.x += ball.dx;
            ball.y += ball.dy;
            
            if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= this.canvas.width) {
                ball.dx = -ball.dx;
                this.createHitEffect(ball.x, ball.y, '#cbd5e0');
                // Prevent horizontal trapping by adding slight vertical component
                if (Math.abs(ball.dy) < 1) {
                    ball.dy = ball.dy > 0 ? 2 : -2;
                }
            }
            if (ball.y - ball.radius <= 0) {
                ball.dy = -ball.dy;
                this.createHitEffect(ball.x, ball.y, '#cbd5e0');
                // Ensure minimum vertical speed when bouncing off top
                if (ball.dy > 0 && ball.dy < 2) {
                    ball.dy = 2;
                }
            }
            
            if (ball.y > this.canvas.height + 50) {
                this.balls.splice(index, 1);
                if (this.balls.length === 0) {
                    this.loseLife();
                }
            }
        });
    }
    
    updatePowerups() {
        this.powerups.forEach((powerup, index) => {
            powerup.y += 3;
            powerup.rotation += 0.1;
            
            if (powerup.y > this.canvas.height) {
                this.powerups.splice(index, 1);
            }
        });
    }
    
    updateParticles() {
        this.particles.forEach((particle, index) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1;
            particle.life -= 0.02;
            
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
    }
    
    updatePowerupTimer() {
        if (this.powerupTimer > 0) {
            this.powerupTimer--;
            if (this.powerupTimer === 0) {
                this.paddle.width = this.paddle.normalWidth;
            }
        }
    }
    
    checkCollisions() {
        this.balls.forEach(ball => {
            if (ball.y + ball.radius >= this.paddle.y && 
                ball.x >= this.paddle.x && 
                ball.x <= this.paddle.x + this.paddle.width) {
                
                const hitPos = (ball.x - this.paddle.x) / this.paddle.width;
                const angle = Math.PI * (0.2 + hitPos * 0.6);
                const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                
                ball.dx = speed * Math.cos(angle - Math.PI/2);
                ball.dy = -speed * Math.sin(angle - Math.PI/2);
                ball.y = this.paddle.y - ball.radius;
                
                // Ensure minimum upward velocity to prevent horizontal bouncing
                if (ball.dy > -2) {
                    ball.dy = -2;
                }
                
                this.createHitEffect(ball.x, ball.y, '#48bb78');
            }
            
            this.bricks.forEach((brick, brickIndex) => {
                if (ball.x + ball.radius >= brick.x && 
                    ball.x - ball.radius <= brick.x + brick.width &&
                    ball.y + ball.radius >= brick.y && 
                    ball.y - ball.radius <= brick.y + brick.height) {
                    
                    const overlapX = Math.min(ball.x + ball.radius - brick.x, 
                                            brick.x + brick.width - (ball.x - ball.radius));
                    const overlapY = Math.min(ball.y + ball.radius - brick.y, 
                                            brick.y + brick.height - (ball.y - ball.radius));
                    
                    if (overlapX < overlapY) {
                        ball.dx = -ball.dx;
                        // Prevent horizontal trapping
                        if (Math.abs(ball.dy) < 1) {
                            ball.dy = ball.dy > 0 ? 2 : -2;
                        }
                    } else {
                        ball.dy = -ball.dy;
                        // Ensure minimum vertical speed
                        if (Math.abs(ball.dy) < 2) {
                            ball.dy = ball.dy > 0 ? 2 : -2;
                        }
                    }
                    
                    this.hitBrick(brick, brickIndex);
                }
            });
        });
        
        this.powerups.forEach((powerup, index) => {
            if (powerup.x + 15 >= this.paddle.x && 
                powerup.x - 15 <= this.paddle.x + this.paddle.width &&
                powerup.y + 15 >= this.paddle.y && 
                powerup.y - 15 <= this.paddle.y + this.paddle.height) {
                
                this.activatePowerup(powerup.type);
                this.powerups.splice(index, 1);
                this.createHitEffect(powerup.x, powerup.y, powerup.color);
            }
        });
    }
    
    hitBrick(brick, index) {
        if (brick.type === 'unbreakable') {
            this.createHitEffect(brick.x + brick.width/2, brick.y + brick.height/2, brick.color);
            return;
        }
        
        brick.hits--;
        this.score += this.brickTypes[brick.type].points;
        
        if (brick.hits > 0) {
            const alpha = brick.hits / brick.maxHits;
            brick.color = this.adjustColorAlpha(this.brickTypes[brick.type].color, alpha);
        } else {
            this.createBrickDestroyEffect(brick);
            
            if (Math.random() < 0.15) {
                const types = Object.keys(this.powerupTypes);
                const type = types[Math.floor(Math.random() * types.length)];
                this.createPowerup(brick.x + brick.width/2, brick.y + brick.height/2, type);
            }
            
            this.bricks.splice(index, 1);
        }
        
        this.updateUI();
    }
    
    createPowerup(x, y, type) {
        this.powerups.push({
            x: x,
            y: y,
            type: type,
            color: this.powerupTypes[type].color,
            rotation: 0
        });
    }
    
    activatePowerup(type) {
        switch (type) {
            case 'bigPaddle':
                this.paddle.width = this.paddle.normalWidth * 1.5;
                this.powerupTimer = 600;
                break;
            case 'multiBall':
                const mainBall = this.balls[0];
                if (mainBall) {
                    for (let i = 0; i < 2; i++) {
                        const angle = Math.random() * Math.PI * 0.5 + Math.PI * 0.25;
                        const speed = Math.sqrt(mainBall.dx * mainBall.dx + mainBall.dy * mainBall.dy);
                        this.balls.push({
                            x: mainBall.x,
                            y: mainBall.y,
                            radius: mainBall.radius,
                            dx: speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1),
                            dy: -speed * Math.sin(angle),
                            baseSpeed: mainBall.baseSpeed
                        });
                    }
                }
                break;
            case 'extraLife':
                this.lives++;
                this.updateUI();
                break;
        }
    }
    
    createHitEffect(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1,
                color: color
            });
        }
    }
    
    createBrickDestroyEffect(brick) {
        for (let i = 0; i < 12; i++) {
            this.particles.push({
                x: brick.x + Math.random() * brick.width,
                y: brick.y + Math.random() * brick.height,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1,
                color: brick.color
            });
        }
    }
    
    adjustColorAlpha(color, alpha) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    loseLife() {
        this.lives--;
        this.updateUI();
        
        if (this.lives > 0) {
            this.balls = [{
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
                radius: 8,
                dx: 4 * (Math.random() > 0.5 ? 1 : -1),
                dy: -4,
                baseSpeed: this.ball.baseSpeed
            }];
            this.paddle.width = this.paddle.normalWidth;
            this.powerupTimer = 0;
        } else {
            this.gameOver();
        }
    }
    
    checkWinLose() {
        const breakableBricks = this.bricks.filter(brick => brick.type !== 'unbreakable');
        if (breakableBricks.length === 0) {
            this.levelComplete();
        }
    }
    
    levelComplete() {
        this.level++;
        this.updateUI();
        this.createLevel();
        
        this.balls.forEach(ball => {
            ball.x = this.canvas.width / 2;
            ball.y = this.canvas.height / 2;
        });
        
        this.paddle.width = this.paddle.normalWidth;
        this.powerupTimer = 0;
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('blockBreakerHighScore', this.highScore.toString());
        }
        this.showOverlay('Game Over', `Final Score: ${this.score}<br>High Score: ${this.highScore}`);
    }
    
    showOverlay(title, text) {
        document.getElementById('overlayTitle').textContent = title;
        document.getElementById('overlayText').innerHTML = text;
        this.overlay.style.display = 'block';
    }
    
    restart() {
        this.overlay.style.display = 'none';
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.paddle.width = this.paddle.normalWidth;
        this.paddle.x = this.canvas.width / 2 - 60;
        this.powerupTimer = 0;
        
        this.balls = [{
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            radius: 8,
            dx: 4,
            dy: -4,
            baseSpeed: 4
        }];
        
        this.powerups = [];
        this.particles = [];
        this.createLevel();
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.renderBricks();
        this.renderPaddle();
        this.renderBalls();
        this.renderPowerups();
        this.renderParticles();
    }
    
    renderBricks() {
        this.bricks.forEach(brick => {
            this.ctx.fillStyle = brick.color;
            this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        });
    }
    
    renderPaddle() {
        const gradient = this.ctx.createLinearGradient(this.paddle.x, this.paddle.y, 
                                                      this.paddle.x, this.paddle.y + this.paddle.height);
        gradient.addColorStop(0, '#0060afff');
        gradient.addColorStop(1, '#d6f333ff');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        
        if (this.powerupTimer > 0) {
            this.ctx.strokeStyle = '#ffd700';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.paddle.x - 2, this.paddle.y - 2, 
                               this.paddle.width + 4, this.paddle.height + 4);
        }
    }
    
    renderBalls() {
        this.balls.forEach(ball => {
            const gradient = this.ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius);
            gradient.addColorStop(0, '#1ec5b7ff');
            gradient.addColorStop(1, '#0d0e0dff');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add subtle border
            this.ctx.strokeStyle = '#cbd5e0';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        });
    }
    
    renderPowerups() {
        this.powerups.forEach(powerup => {
            this.ctx.save();
            this.ctx.translate(powerup.x, powerup.y);
            this.ctx.rotate(powerup.rotation);
            
            this.ctx.fillStyle = powerup.color;
            this.ctx.fillRect(-15, -15, 30, 30);
            
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-15, -15, 30, 30);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px bold Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('P', 0, 5);
            
            this.ctx.restore();
        });
    }
    
    renderParticles() {
        this.particles.forEach(particle => {
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

const game = new Game();
window.game = game;