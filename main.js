const GRID_SIZE = 24; // Scaled down grid for larger cells

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
        artillery: { icon: 'pig_artillery.png', img: 'pig_artillery.png' },
        musketeer: { icon: '🐷🔫', img: null } 
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
let gameMode = 'PLACEMENT'; 

let placementPool = {};
let selectedPlacementType = null;
let placementFactions = [CAT, PIG];
let placementTurnIdx = 0; 

let selectedUnit = null;
let currentRemainingMove = 0;
let hasAttackedThisTurn = false;
let hasMovedThisTurn = false;

// Youtube Player & Audio Engine
let ytPlayer = null;
let bgmOn = true;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('bgm-player', {
        height: '0',
        width: '0',
        videoId: 'vOepN-8x8t0',
        playerVars: { 'autoplay': 0, 'loop': 1, 'playlist': 'vOepN-8x8t0' }
    });
}

document.getElementById('btn-toggle-bgm').addEventListener('click', (e) => {
    bgmOn = !bgmOn;
    e.target.textContent = bgmOn ? '🎵 BGM 끄기' : '🔇 BGM 켜기';
    e.target.className = bgmOn ? '' : 'off';
    
    // Only play if battle has started
    if(ytPlayer && ytPlayer.playVideo && ytPlayer.pauseVideo) {
        if(bgmOn && gameMode === 'BATTLE') {
            ytPlayer.playVideo();
        } else {
            ytPlayer.pauseVideo();
        }
    }
});

// Retro Web Audio SFX
function playSFX(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    
    if (type === 'infantry') {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.15);
    }
    else if (type === 'artillery') {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.6);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t); osc.stop(t + 0.6);
    }
    else if (type === 'cavalry') {
        // Gallop 3 times
        for(let i=0; i<3; i++) {
            let osc = audioCtx.createOscillator();
            let g = audioCtx.createGain();
            osc.frequency.setValueAtTime(150, t + i*0.12);
            g.gain.setValueAtTime(0.4, t + i*0.12);
            g.gain.exponentialRampToValueAtTime(0.01, t + i*0.12 + 0.1);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(t + i*0.12); osc.stop(t + i*0.12 + 0.1);
        }
        // Then slash
        setTimeout(() => playSFX('infantry'), 350);
    }
    else if (type === 'musketeer') {
        // Gunshot white noise
        const bufSize = audioCtx.sampleRate * 0.25;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        let noise = audioCtx.createBufferSource();
        noise.buffer = buf;
        
        let pFilter = audioCtx.createBiquadFilter();
        pFilter.type = 'bandpass';
        pFilter.frequency.value = 800;
        
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        
        noise.connect(pFilter); pFilter.connect(gain); gain.connect(audioCtx.destination);
        noise.start(t);
    }
}

function initGame() {
    board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    units = [];
    gameMode = 'PLACEMENT';
    placementTurnIdx = 0;
    currentTurn = placementFactions[placementTurnIdx];
    selectedPlacementType = null;
    selectedUnit = null;
    
    const catAlive = document.getElementById('cat-count');
    if(catAlive) { catAlive.textContent = "10"; }
    const PigAlive = document.getElementById('pig-count');
    if(PigAlive) { PigAlive.textContent = "10"; }

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
            placementTurnIdx++;
            currentTurn = placementFactions[placementTurnIdx];
            selectedPlacementType = null;
            log("고양이 제국 배치 완료! 이제 돼지 제국이 진영 오른쪽에 배치합니다.");
            renderPlacementUI();
            updateUI();
        } else {
            document.getElementById('placement-instruction').classList.add('hidden');
            document.getElementById('placement-pool').classList.add('hidden');
            document.getElementById('btn-start-battle').classList.remove('hidden');
            clearHighlights();
        }
    }
}

function highlightPlacementZones() {
    clearHighlights();
    const isCat = currentTurn === CAT;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            // Cat: Left 5 columns, Pig: Right 5 columns
            let valid = isCat ? (x < 5) : (x >= GRID_SIZE - 5);
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
    
    if (bgmOn && ytPlayer && typeof ytPlayer.playVideo === 'function') {
        ytPlayer.playVideo();
    }
    
    // Unlock Audio Context explicitly on user action
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    log("웅장한 BGM 재생... 전투를 시작합니다! 고양이 제국의 선공입니다.");
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
        if (!cell) return;
        
        const uDiv = document.createElement('div');
        uDiv.className = `unit unit-container ${unit.isDead ? 'incapacitated' : ''} ${selectedUnit === unit ? 'selected' : ''}`;
        uDiv.id = `unit-${unit.id}`;
        
        if (!unit.isDead && gameMode === 'BATTLE') {
            const hpDiv = document.createElement('div');
            hpDiv.className = 'unit-hp';
            
            const hpFill = document.createElement('div');
            hpFill.className = 'unit-hp-fill';
            hpFill.style.width = `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%`;
            
            const hpText = document.createElement('div');
            hpText.className = 'unit-hp-text';
            hpText.textContent = `${unit.hp}`;
            
            hpDiv.appendChild(hpFill);
            hpDiv.appendChild(hpText);
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
        if (currentTurn === CAT && x < 5) valid = true;
        if (currentTurn === PIG && x >= GRID_SIZE - 5) valid = true;
        
        if (valid && !board[y][x]) {
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
            if (hasMovedThisTurn) {
                log("이번 턴에 이미 이동했습니다. (이동은 한 턴에 1번만 가능합니다!)");
                return;
            }
            const d = dist(selectedUnit.x, selectedUnit.y, x, y);
            if (d > 0 && d <= currentRemainingMove) {
                moveSelected(x, y, d);
                return;
            }
        }
    }

    if (clickedUnit && clickedUnit.faction === currentTurn && !clickedUnit.isDead) {
        if (selectedUnit && selectedUnit !== clickedUnit) {
            if (hasMovedThisTurn || hasAttackedThisTurn) {
                log("결정을 취소할 수 없습니다. 턴 종료를 눌러주세요.");
                return;
            }
        }

        selectedUnit = clickedUnit;
        currentRemainingMove = selectedUnit.movement;
        hasAttackedThisTurn = false;
        hasMovedThisTurn = false;
        
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
    hasMovedThisTurn = true;
    log(`${selectedUnit.name} 이동 완료! (남은 타격 사거리: ${currentRemainingMove})`);
    
    renderUnits();
    highlightOptions();
    
    if (currentRemainingMove === 0) {
        log("이동거리를 모두 소모하여 턴이 자동으로 종료됩니다.");
        endTurn();
    }
}

function attack(attacker, defender) {
    defender.hp -= attacker.damage;
    hasAttackedThisTurn = true;
    log(`⚔️ ${attacker.name}(이)가 ${defender.name} 공격! (-${attacker.damage})`);
    
    // Play SFX
    playSFX(attacker.type);

    // Apply animation CSS class temporarily
    const attackerEl = document.getElementById(`unit-${attacker.id}`);
    const defenderEl = document.getElementById(`unit-${defender.id}`);
    
    // Directional lunge
    if(attackerEl) {
        const dx = defender.x - attacker.x;
        const dy = defender.y - attacker.y;
        if(Math.abs(dx) > Math.abs(dy)) {
            attackerEl.classList.add(dx > 0 ? 'anim-lunge-right' : 'anim-lunge-left');
        } else {
            attackerEl.classList.add(dy > 0 ? 'anim-lunge-down' : 'anim-lunge-up');
        }
        setTimeout(() => attackerEl.className = attackerEl.className.replace(/anim-lunge-[a-z]+/g, '').trim(), 300);
    }
    
    if(defenderEl) {
        defenderEl.classList.add('anim-damage');
        setTimeout(() => defenderEl.classList.remove('anim-damage'), 400);
    }

    if (defender.hp <= 0) {
        defender.hp = 0;
        defender.isDead = true;
        board[defender.y][defender.x] = null; 
        log(`💀 ${defender.name} 파괴됨!`);
    }
    
    // Delay render briefly so animation plays properly
    setTimeout(() => {
        renderUnits();
        highlightOptions();
        log("공격을 마쳤으므로 턴이 자동으로 종료됩니다.");
        endTurn();
    }, 450); // wait until animation finishes
}

function endTurn() {
    if(!selectedUnit) log("턴이 넘어갑니다.");
    selectedUnit = null;
    hasMovedThisTurn = false;
    hasAttackedThisTurn = false;
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
    const loglist = document.getElementById('battle-log');
    loglist.innerHTML = '';
    
    initGame();
});

initGame();
