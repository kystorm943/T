const GRID_SIZE = 32;

// Factions
const CAT = 'cat';
const PIG = 'pig';

// Assets mapping (fallback to emojis if images didn't generate)
const ASSETS = {
    cat: {
        infantry: { icon: '🐱🗡️', img: null },
        cavalry: { icon: '🐱🐎', img: null },
        artillery: { icon: 'cat_artillery.png', img: 'cat_artillery.png' },
        musketeer: { icon: '🐱🧨', img: null } // 조총병
    },
    pig: {
        infantry: { icon: 'pig_infantry.png', img: 'pig_infantry.png' },
        cavalry: { icon: 'pig_cavalry.png', img: 'pig_cavalry.png' },
        artillery: { icon: '🐷🏹', img: null } 
    }
};

const UNIT_STATS = {
    infantry: { name: '보병', hp: 100, damage: 35, movement: 2 },
    cavalry: { name: '기병', hp: 100, damage: 25, movement: 5 },
    artillery: { name: '포병', hp: 100, damage: 45, movement: 3 },
    musketeer: { name: '조총병', hp: 80, damage: 55, movement: 3 } // 조총병 특성
};

let board = []; 
let units = [];
let currentTurn = CAT;
let selectedUnit = null;
let currentRemainingMove = 0;
let hasAttackedThisTurn = false;

function initGame() {
    board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    units = [];
    currentTurn = CAT;
    selectedUnit = null;
    currentRemainingMove = 0;
    hasAttackedThisTurn = false;
    
    spawnTeam(CAT, 0);
    spawnTeam(PIG, GRID_SIZE - 2);

    renderBoard();
    updateUI();
    log("전투가 시작되었습니다! 고양이 제국의 선공입니다.");
}

function spawnTeam(faction, startCol) {
    let specs = [];
    if (faction === CAT) {
        specs = [
            { type: 'cavalry', count: 2 },
            { type: 'artillery', count: 2 },
            { type: 'infantry', count: 3 },
            { type: 'musketeer', count: 3 }
        ];
    } else {
        specs = [
            { type: 'cavalry', count: 3 },
            { type: 'artillery', count: 3 },
            { type: 'infantry', count: 4 }
        ];
    }
    
    let spawnPoints = [];
    for(let x=startCol; x < startCol + 2; x++) {
        for(let y=8; y < 24; y += 1) { 
            spawnPoints.push({x, y});
        }
    }
    spawnPoints.sort(() => Math.random() - 0.5);

    let idx = 0;
    for (let spec of specs) {
        for (let i = 0; i < spec.count; i++) {
            let pt = spawnPoints[idx++];
            let unit = {
                id: `${faction}_${spec.type}_${i}`,
                faction: faction,
                type: spec.type,
                name: `${faction === CAT ? '고양이' : '돼지'} ${UNIT_STATS[spec.type].name}`,
                maxHp: UNIT_STATS[spec.type].hp,
                hp: UNIT_STATS[spec.type].hp,
                damage: UNIT_STATS[spec.type].damage,
                movement: UNIT_STATS[spec.type].movement,
                x: pt.x,
                y: pt.y,
                isDead: false
            };
            units.push(unit);
            board[pt.y][pt.x] = unit;
        }
    }
}

function renderBoard() {
    const container = document.getElementById('game-board');
    if(container.children.length === 0) {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                if ((x + y) % 2 === 0) cell.classList.add('checker');
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.id = `cell-${x}-${y}`;
                cell.addEventListener('click', () => handleCellClick(x, y));
                container.appendChild(cell);
            }
        }
    }
    renderUnits();
}

function renderUnits() {
    document.querySelectorAll('.unit-container').forEach(e => e.remove());
    units.forEach(unit => {
        const cell = document.getElementById(`cell-${unit.x}-${unit.y}`);
        
        const uDiv = document.createElement('div');
        uDiv.className = `unit unit-container ${unit.isDead ? 'incapacitated' : ''} ${selectedUnit === unit ? 'selected' : ''}`;
        
        if (!unit.isDead) {
            const hpDiv = document.createElement('div');
            hpDiv.className = 'unit-hp';
            const hpFill = document.createElement('div');
            hpFill.className = 'unit-hp-fill';
            hpFill.style.width = `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%`;
            if (unit.faction === CAT) hpFill.style.backgroundColor = '#3498db';
            else hpFill.style.backgroundColor = '#e74c3c';
            hpDiv.appendChild(hpFill);
            uDiv.appendChild(hpDiv);
        }

        const asset = ASSETS[unit.faction][unit.type];
        if (asset.img) {
            const img = document.createElement('img');
            img.src = asset.img;
            uDiv.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.className = 'unit-emoji';
            span.textContent = asset.icon;
            uDiv.appendChild(span);
        }
        cell.appendChild(uDiv);
    });
}

function clearHighlights() {
    document.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('highlight-move');
        c.classList.remove('highlight-attack');
    });
}

function dist(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function handleCellClick(x, y) {
    let clickedUnit = board[y][x];

    if (selectedUnit && !selectedUnit.isDead) {
        // Attack enemy
        if (clickedUnit && clickedUnit.faction !== currentTurn && !clickedUnit.isDead) {
            if (!hasAttackedThisTurn) {
                const d = dist(selectedUnit.x, selectedUnit.y, x, y);
                if (d > 0 && d <= currentRemainingMove) {
                    attack(selectedUnit, clickedUnit);
                    return;
                } else {
                    log("공격 범위를 벗어났습니다! (남은 이동력이 공격 사거리입니다)");
                }
            } else {
                log("이번 턴에 이미 공격했습니다.");
            }
            return;
        }

        // Move to empty cell
        if (!clickedUnit) {
            const d = dist(selectedUnit.x, selectedUnit.y, x, y);
            if (d > 0 && d <= currentRemainingMove) {
                moveSelected(x, y, d);
                return;
            }
        }
    }

    // Select friendly unit
    if (clickedUnit && clickedUnit.faction === currentTurn && !clickedUnit.isDead) {
        if (selectedUnit && selectedUnit !== clickedUnit) {
            // Cannot change unit if already moved/attacked
            if (currentRemainingMove < selectedUnit.movement || hasAttackedThisTurn) {
                log("이미 이번 턴에 행동을 시작한 유닛이 있습니다. 턴 종료를 눌러주세요.");
                return;
            }
        }

        selectedUnit = clickedUnit;
        currentRemainingMove = selectedUnit.movement;
        hasAttackedThisTurn = false;
        
        showInfo(selectedUnit);
        highlightOptions();
        renderUnits();
        log(`${selectedUnit.name} 선택됨 (이동력: ${currentRemainingMove})`);
        return;
    }
}

function highlightOptions() {
    clearHighlights();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            let d = dist(selectedUnit.x, selectedUnit.y, x, y);
            let targetUnit = board[y][x];

            if (d > 0 && d <= currentRemainingMove) {
                if (!targetUnit) {
                    document.getElementById(`cell-${x}-${y}`).classList.add('highlight-move');
                } else if (targetUnit.faction !== selectedUnit.faction && !targetUnit.isDead && !hasAttackedThisTurn) {
                    document.getElementById(`cell-${x}-${y}`).classList.add('highlight-attack');
                }
            }
        }
    }
}

function moveSelected(x, y, distance) {
    board[selectedUnit.y][selectedUnit.x] = null;
    selectedUnit.x = x;
    selectedUnit.y = y;
    board[y][x] = selectedUnit;
    
    currentRemainingMove -= distance;
    log(`${selectedUnit.name} 이동! (남은 이동 및 공격 사거리: ${currentRemainingMove})`);
    
    renderUnits();
    highlightOptions();
    
    if (currentRemainingMove === 0 && hasAttackedThisTurn) {
        endTurn();
    }
}

function attack(attacker, defender) {
    defender.hp -= attacker.damage;
    hasAttackedThisTurn = true;
    log(`⚔️ ${attacker.name}이(가) ${defender.name}을(를) 공격! (-${attacker.damage} HP)`);
    
    if (defender.hp <= 0) {
        defender.hp = 0;
        defender.isDead = true;
        board[defender.y][defender.x] = null; 
        log(`💀 ${defender.name}이(가) 쓰러졌습니다!`);
    }
    
    renderUnits();
    highlightOptions();
    
    if (currentRemainingMove === 0 || hasAttackedThisTurn) {
        endTurn();
    }
}

function endTurn() {
    if(!selectedUnit) {
        log("선택된 유닛 없이 턴을 종료합니다.");
    } else {
        log(`${selectedUnit.name}의 행동 종료.`);
    }

    selectedUnit = null;
    clearHighlights();
    
    // Check win
    const catAlive = units.filter(u => u.faction === CAT && !u.isDead).length;
    const pigAlive = units.filter(u => u.faction === PIG && !u.isDead).length;
    
    if (catAlive === 0) return gameOver("돼지 제국 승리! 🐷");
    if (pigAlive === 0) return gameOver("고양이 제국 승리! 🐱");

    currentTurn = currentTurn === CAT ? PIG : CAT;
    updateUI();
    renderUnits();
}

document.getElementById('btn-end-turn').addEventListener('click', endTurn);

function gameOver(message) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('winner-text').textContent = message;
}

function updateUI() {
    const indicator = document.getElementById('turn-indicator');
    if (currentTurn === CAT) {
        indicator.textContent = "고양이 제국 턴 🐱";
        indicator.className = 'turn-cat';
    } else {
        indicator.textContent = "돼지 제국 턴 🐷";
        indicator.className = 'turn-pig';
    }
    
    document.getElementById('cat-count').textContent = units.filter(u => u.faction === CAT && !u.isDead).length;
    document.getElementById('pig-count').textContent = units.filter(u => u.faction === PIG && !u.isDead).length;
    document.getElementById('unit-info').classList.add('hidden');
}

function showInfo(unit) {
    const info = document.getElementById('unit-info');
    info.classList.remove('hidden');
    document.getElementById('info-name').textContent = unit.name;
    document.getElementById('info-hp').textContent = Math.max(0, unit.hp);
    document.getElementById('info-hp-bar').style.width = `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%`;
    document.getElementById('info-damage').textContent = unit.damage;
    document.getElementById('info-movement').textContent = unit.movement;
    
    const asset = ASSETS[unit.faction][unit.type];
    document.getElementById('info-icon').src = asset.img || '';
    document.getElementById('info-icon').alt = asset.icon;
}

function log(msg) {
    const list = document.getElementById('battle-log');
    const li = document.createElement('li');
    li.textContent = `[${new Date().toLocaleTimeString('en-US',{hour12:false})}] ${msg}`;
    list.prepend(li);
}

document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    initGame();
});

initGame();
