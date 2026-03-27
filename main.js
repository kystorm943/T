const GRID_SIZE = 32;

// Factions
const CAT = 'cat';
const PIG = 'pig';

const ASSETS = {
    cat: {
        infantry: { icon: '🐱🗡️', img: null },
        cavalry: { icon: '🐱🐎', img: null },
        artillery: { icon: 'cat_artillery.png', img: 'cat_artillery.png' },
        musketeer: { icon: '🐱🧨', img: null }
    },
    pig: {
        infantry: { icon: 'pig_infantry.png', img: 'pig_infantry.png' },
        cavalry: { icon: 'pig_cavalry.png', img: 'pig_cavalry.png' },
        artillery: { icon: '🐷🏹', img: null },
        musketeer: { icon: '🐷🔫', img: null } // fallback to prevent errors if pigs want it
    }
};

const UNIT_STATS = {
    infantry: { name: '보병', hp: 100, damage: 35, movement: 2 },
    cavalry: { name: '기병', hp: 100, damage: 25, movement: 5 },
    artillery: { name: '포병', hp: 100, damage: 45, movement: 3 },
    musketeer: { name: '조총병', hp: 80, damage: 55, movement: 3 }
};

let board = []; 
let units = [];
let currentTurn = CAT;
let gameMode = 'PLACEMENT'; // PLACEMENT or BATTLE

// Placement logic
let placementPool = {};
let selectedPlacementType = null;
let placementFactions = [CAT, PIG];
let placementTurnIdx = 0; // 0 = CAT, 1 = PIG

let selectedUnit = null;
let currentRemainingMove = 0;
let hasAttackedThisTurn = false;

// Youtube Player
let ytPlayer = null;

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('bgm-player', {
        height: '0',
        width: '0',
        videoId: 'vOepN-8x8t0', // 신세계로부터 교향곡 4악장
        playerVars: { 'autoplay': 0, 'loop': 1, 'playlist': 'vOepN-8x8t0' }
    });
}

function initGame() {
    board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    units = [];
    gameMode = 'PLACEMENT';
    placementTurnIdx = 0;
    currentTurn = placementFactions[placementTurnIdx];
    selectedPlacementType = null;
    selectedUnit = null;

    placementPool = {
        cat: { musketeer: 3, infantry: 3, cavalry: 2, artillery: 2 },
        pig: { infantry: 4, cavalry: 3, artillery: 3 }
    };

    renderBoard();
    updateUI();
    document.getElementById('battle-log').innerHTML = '<li>진영 왼쪽에 유닛을 배치해주세요!</li>';
    renderPlacementUI();
}

function renderPlacementUI() {
    const pool = placementPool[currentTurn];
    const container = document.getElementById('placement-pool');
    container.innerHTML = '';
    
    let totalLeft = 0;

    for (const [type, count] of Object.entries(pool)) {
        totalLeft += count;
        const item = document.createElement('div');
        item.className = 'placement-item';
        if (count === 0) item.classList.add('disabled');
        if (selectedPlacementType === type) item.classList.add('selected');
        
        const asset = ASSETS[currentTurn][type];
        if (asset.img) {
            const img = document.createElement('img');
            img.src = asset.img;
            item.appendChild(img);
        } else {
            item.textContent = asset.icon;
        }

        const countSpan = document.createElement('span');
        countSpan.className = 'placement-count';
        countSpan.textContent = count;
        item.appendChild(countSpan);

        item.addEventListener('click', () => {
            if (count > 0) {
                selectedPlacementType = type;
                renderPlacementUI();
                highlightPlacementZones();
            }
        });

        container.appendChild(item);
    }

    if (totalLeft === 0) {
        if (placementTurnIdx === 0) {
            // Cats done, pig turn
            placementTurnIdx++;
            currentTurn = placementFactions[placementTurnIdx];
            selectedPlacementType = null;
            log("고양이 제국 배치 완료! 이제 돼지 제국이 진영 오른쪽에 배치합니다.");
            renderPlacementUI();
            updateUI();
        } else {
            // Both done
            document.getElementById('placement-instruction').classList.add('hidden');
            document.getElementById('placement-pool').classList.add('hidden');
            const btnStart = document.getElementById('btn-start-battle');
            btnStart.classList.remove('hidden');
            clearHighlights();
        }
    }
}

function highlightPlacementZones() {
    clearHighlights();
    const isCat = currentTurn === CAT;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            let valid = isCat ? (x < 6) : (x >= GRID_SIZE - 6);
            if (valid && !board[y][x]) {
                document.getElementById(`cell-${x}-${y}`).classList.add('highlight-placement');
            }
        }
    }
}

document.getElementById('btn-start-battle').addEventListener('click', () => {
    gameMode = 'BATTLE';
    currentTurn = CAT;
    
    document.getElementById('placement-ui').classList.add('hidden');
    document.getElementById('battle-ui').classList.remove('hidden');
    
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
        ytPlayer.playVideo();
    }
    
    log("전투 음악 재생... 전투를 시작합니다! 고양이 제국의 선공입니다.");
    updateUI();
});

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
        
        if (!unit.isDead && gameMode === 'BATTLE') {
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
        c.className = c.className.replace(/highlight-[a-z]+/g, '').trim();
    });
}

function dist(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function handleCellClick(x, y) {
    if (gameMode === 'PLACEMENT') {
        if (!selectedPlacementType) return;
        
        let valid = false;
        if (currentTurn === CAT && x < 6) valid = true;
        if (currentTurn === PIG && x >= GRID_SIZE - 6) valid = true;
        
        if (valid && !board[y][x]) {
            // Place unit
            let pType = selectedPlacementType;
            let unit = {
                id: `${currentTurn}_${pType}_${Date.now()}`,
                faction: currentTurn,
                type: pType,
                name: `${currentTurn === CAT ? '고양이' : '돼지'} ${UNIT_STATS[pType].name}`,
                maxHp: UNIT_STATS[pType].hp,
                hp: UNIT_STATS[pType].hp,
                damage: UNIT_STATS[pType].damage,
                movement: UNIT_STATS[pType].movement,
                x: x,
                y: y,
                isDead: false
            };
            units.push(unit);
            board[y][x] = unit;
            
            placementPool[currentTurn][pType]--;
            if (placementPool[currentTurn][pType] === 0) {
                selectedPlacementType = null;
                clearHighlights();
            }
            renderPlacementUI();
            renderUnits();
        }
        return;
    }

    // BATTLE MODE
    let clickedUnit = board[y][x];

    if (selectedUnit && !selectedUnit.isDead) {
        if (clickedUnit && clickedUnit.faction !== currentTurn && !clickedUnit.isDead) {
            if (!hasAttackedThisTurn) {
                const d = dist(selectedUnit.x, selectedUnit.y, x, y);
                if (d > 0 && d <= currentRemainingMove) {
                    attack(selectedUnit, clickedUnit);
                    return;
                } else {
                    log("공격 범위를 벗어났습니다!");
                }
            } else {
                log("이번 턴에 이미 공격했습니다.");
            }
            return;
        }

        if (!clickedUnit) {
            const d = dist(selectedUnit.x, selectedUnit.y, x, y);
            if (d > 0 && d <= currentRemainingMove) {
                moveSelected(x, y, d);
                return;
            }
        }
    }

    if (clickedUnit && clickedUnit.faction === currentTurn && !clickedUnit.isDead) {
        if (selectedUnit && selectedUnit !== clickedUnit) {
            if (currentRemainingMove < selectedUnit.movement || hasAttackedThisTurn) {
                log("결정을 취소할 수 없습니다. 턴 종료를 눌러주세요.");
                return;
            }
        }

        selectedUnit = clickedUnit;
        currentRemainingMove = selectedUnit.movement;
        hasAttackedThisTurn = false;
        
        showInfo(selectedUnit);
        highlightOptions();
        renderUnits();
        log(`${selectedUnit.name} 선택됨`);
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
    log(`${selectedUnit.name} 이동 완료!`);
    
    renderUnits();
    highlightOptions();
    
    if (currentRemainingMove === 0 && hasAttackedThisTurn) {
        endTurn();
    }
}

function attack(attacker, defender) {
    defender.hp -= attacker.damage;
    hasAttackedThisTurn = true;
    log(`⚔️ ${attacker.name}(이)가 ${defender.name} 공격! (-${attacker.damage})`);
    
    if (defender.hp <= 0) {
        defender.hp = 0;
        defender.isDead = true;
        board[defender.y][defender.x] = null; 
        log(`💀 ${defender.name} 파괴됨!`);
    }
    
    renderUnits();
    highlightOptions();
    
    if (currentRemainingMove === 0 || hasAttackedThisTurn) {
        endTurn();
    }
}

function endTurn() {
    if(!selectedUnit) log("턴이 종료되었습니다.");
    selectedUnit = null;
    clearHighlights();
    
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
    if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
}

function updateUI() {
    const indicator = document.getElementById('turn-indicator');
    
    if (gameMode === 'PLACEMENT') {
        indicator.textContent = currentTurn === CAT ? "배치: 고양이 제국 ✨" : "배치: 돼지 제국 ✨";
        indicator.className = 'turn-placement';
        return;
    }

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
    
    document.getElementById('battle-ui').classList.add('hidden');
    document.getElementById('placement-ui').classList.remove('hidden');
    document.getElementById('placement-instruction').classList.remove('hidden');
    document.getElementById('placement-pool').classList.remove('hidden');
    document.getElementById('btn-start-battle').classList.add('hidden');
    
    initGame();
});

// Initialize on load
initGame();
