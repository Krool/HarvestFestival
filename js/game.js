// Harvest Festival - Single File Build
(function() {
    'use strict';

    // ==================== UTILITIES ====================
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function formatTime(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function hexToRgba(hex, alpha) {
        alpha = alpha || 1;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    // ==================== STATE ====================
    const STORAGE_KEY = 'harvestFestival_state';
    const TIMER_DURATION = 12 * 60 * 60 * 1000;

    let state = null;
    let stateListeners = [];

    function createDefaultState() {
        const now = Date.now();
        return {
            seeds: 50,
            timerEnd: now + TIMER_DURATION,
            currentView: 'board',
            selectedTeam: 1,
            gardens: {
                1: createGarden(),
                2: createGarden(),
                3: createGarden(),
                4: createGarden()
            },
            boardOffset: { x: 0, y: 0 }
        };
    }

    function createGarden() {
        const plots = [];
        for (let i = 0; i < 16; i++) {
            plots.push({ xp: 0, stage: 0 });
        }
        return { plots: plots };
    }

    function initState() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                state = JSON.parse(saved);
                if (Date.now() >= state.timerEnd) {
                    state.seeds += 10;
                    state.timerEnd = Date.now() + TIMER_DURATION;
                }
            } catch (e) {
                state = createDefaultState();
            }
        } else {
            state = createDefaultState();
        }
        saveState();
        return state;
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function getState() {
        return state;
    }

    function setState(updates) {
        for (let key in updates) {
            state[key] = updates[key];
        }
        saveState();
        notifyStateListeners();
        return state;
    }

    function updateGardenPlot(team, plotIndex, xpGain) {
        const garden = state.gardens[team];
        const plot = garden.plots[plotIndex];
        plot.xp = Math.min(100, plot.xp + xpGain);
        plot.stage = getStageFromXP(plot.xp);
        saveState();
        notifyStateListeners();
        return plot;
    }

    function addXPToAllPlots(team, xpGain) {
        const garden = state.gardens[team];
        for (let i = 0; i < garden.plots.length; i++) {
            const plot = garden.plots[i];
            plot.xp = Math.min(100, plot.xp + xpGain);
            plot.stage = getStageFromXP(plot.xp);
        }
        saveState();
        notifyStateListeners();
    }

    function consumeSeeds(amount) {
        if (state.seeds >= amount) {
            state.seeds -= amount;
            saveState();
            notifyStateListeners();
            return true;
        }
        return false;
    }

    function getStageFromXP(xp) {
        if (xp >= 100) return 4;
        if (xp >= 75) return 3;
        if (xp >= 50) return 2;
        if (xp >= 25) return 1;
        return 0;
    }

    function subscribeState(listener) {
        stateListeners.push(listener);
    }

    function notifyStateListeners() {
        for (let i = 0; i < stateListeners.length; i++) {
            stateListeners[i](state);
        }
    }

    function getTimerRemaining() {
        return Math.max(0, state.timerEnd - Date.now());
    }

    function checkTimerExpired() {
        if (Date.now() >= state.timerEnd) {
            const bonusSeeds = 10;
            state.seeds += bonusSeeds;
            state.timerEnd = Date.now() + TIMER_DURATION;
            saveState();
            notifyStateListeners();
            return bonusSeeds;
        }
        return 0;
    }

    // ==================== AUDIO ====================
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function ensureAudio() {
        if (!audioCtx) {
            initAudio();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playClick() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
    }

    function playDiceRoll() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const mod = Math.sin(i / ctx.sampleRate * 80 * Math.PI * 2) * 0.5 + 0.5;
            data[i] = (Math.random() * 2 - 1) * mod;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, ctx.currentTime);
        filter.Q.setValueAtTime(2, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.5);
    }

    function playDiceLand() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    }

    function playPlotHit() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const frequencies = [523.25, 659.25, 783.99];
        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i];
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(ctx.destination);
            const startTime = ctx.currentTime + i * 0.02;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            osc.start(startTime);
            osc.stop(startTime + 0.4);
        }
    }

    function playRowHit() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const frequencies = [261.63, 329.63, 392.00, 523.25];
        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i];
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.connect(gain);
            gain.connect(ctx.destination);
            const startTime = ctx.currentTime + i * 0.08;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        }
    }

    function playFullBoardFanfare() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const chord1 = [261.63, 329.63, 392.00];
        const chord2 = [392.00, 493.88, 587.33];
        const chord3 = [523.25, 659.25, 783.99];
        const chords = [
            { freqs: chord1, time: 0 },
            { freqs: chord2, time: 0.25 },
            { freqs: chord3, time: 0.5 }
        ];
        for (let c = 0; c < chords.length; c++) {
            const chord = chords[c];
            for (let f = 0; f < chord.freqs.length; f++) {
                const freq = chord.freqs[f];
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.connect(gain);
                gain.connect(ctx.destination);
                const startTime = ctx.currentTime + chord.time;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.setValueAtTime(0.15, startTime + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
                osc.start(startTime);
                osc.stop(startTime + 0.5);
            }
        }
        const finalOsc = ctx.createOscillator();
        const finalGain = ctx.createGain();
        finalOsc.type = 'sine';
        finalOsc.connect(finalGain);
        finalGain.connect(ctx.destination);
        finalOsc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.75);
        finalGain.gain.setValueAtTime(0.2, ctx.currentTime + 0.75);
        finalGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
        finalOsc.start(ctx.currentTime + 0.75);
        finalOsc.stop(ctx.currentTime + 1.5);
    }

    function playTimerComplete() {
        const ctx = ensureAudio();
        if (!ctx) return;
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(ctx.destination);
            const startTime = ctx.currentTime + i * 0.3;
            osc.frequency.setValueAtTime(880, startTime);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        }
    }

    function playSwoosh() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.1);
        filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.2);
        filter.Q.setValueAtTime(1, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.2);
    }

    // ==================== BOARD ====================
    const TEAM_COLORS = {
        1: '#00CED1',
        2: '#FF6B6B',
        3: '#DDA0DD',
        4: '#90EE90'
    };

    const TEAM_NAMES = { 1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4' };

    let boardCanvas, boardCtx;
    let isDragging = false;
    let lastDragPos = { x: 0, y: 0 };
    let boardSize = 800;
    let centerClickCallback = null;

    function initBoard(canvas, onCenterClick) {
        boardCanvas = canvas;
        boardCtx = canvas.getContext('2d');
        centerClickCallback = onCenterClick;

        resizeBoardCanvas();
        window.addEventListener('resize', resizeBoardCanvas);

        canvas.addEventListener('mousedown', handleBoardDragStart);
        canvas.addEventListener('mousemove', handleBoardDragMove);
        canvas.addEventListener('mouseup', handleBoardDragEnd);
        canvas.addEventListener('mouseleave', handleBoardDragEnd);
        canvas.addEventListener('click', handleBoardClick);

        canvas.addEventListener('touchstart', handleBoardTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleBoardTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleBoardDragEnd);
    }

    function resizeBoardCanvas() {
        boardCanvas.width = window.innerWidth;
        boardCanvas.height = window.innerHeight;
        boardSize = Math.min(boardCanvas.width, boardCanvas.height) * 1.5;
        renderBoard();
    }

    function handleBoardDragStart(e) {
        isDragging = true;
        lastDragPos = { x: e.clientX, y: e.clientY };
    }

    function handleBoardTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            isDragging = true;
            lastDragPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }

    function handleBoardDragMove(e) {
        if (!isDragging) return;
        const st = getState();
        const dx = e.clientX - lastDragPos.x;
        const dy = e.clientY - lastDragPos.y;
        const maxOffset = boardSize / 3;
        const newOffset = {
            x: clamp(st.boardOffset.x + dx, -maxOffset, maxOffset),
            y: clamp(st.boardOffset.y + dy, -maxOffset, maxOffset)
        };
        setState({ boardOffset: newOffset });
        lastDragPos = { x: e.clientX, y: e.clientY };
        renderBoard();
    }

    function handleBoardTouchMove(e) {
        e.preventDefault();
        if (!isDragging || e.touches.length !== 1) return;
        const st = getState();
        const dx = e.touches[0].clientX - lastDragPos.x;
        const dy = e.touches[0].clientY - lastDragPos.y;
        const maxOffset = boardSize / 3;
        const newOffset = {
            x: clamp(st.boardOffset.x + dx, -maxOffset, maxOffset),
            y: clamp(st.boardOffset.y + dy, -maxOffset, maxOffset)
        };
        setState({ boardOffset: newOffset });
        lastDragPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        renderBoard();
    }

    function handleBoardDragEnd() {
        isDragging = false;
    }

    function handleBoardClick(e) {
        const st = getState();
        const rect = boardCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = boardCanvas.width / 2 + st.boardOffset.x;
        const centerY = boardCanvas.height / 2 + st.boardOffset.y;
        const centerSize = boardSize * 0.35;
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < centerSize && centerClickCallback) {
            centerClickCallback();
        }
    }

    function renderBoard() {
        const st = getState();
        boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
        const centerX = boardCanvas.width / 2 + st.boardOffset.x;
        const centerY = boardCanvas.height / 2 + st.boardOffset.y;
        drawBoardBackground(centerX, centerY);
        drawMonopolyBorder(centerX, centerY);
        drawCenterDiamond(centerX, centerY, st);
    }

    function drawBoardBackground(cx, cy) {
        boardCtx.fillStyle = '#F5DEB3';
        drawRoundedRect(boardCtx, cx - boardSize / 2, cy - boardSize / 2, boardSize, boardSize, 20);
        boardCtx.fill();
        boardCtx.fillStyle = '#C8E6C9';
        const innerSize = boardSize * 0.75;
        drawRoundedRect(boardCtx, cx - innerSize / 2, cy - innerSize / 2, innerSize, innerSize, 15);
        boardCtx.fill();
    }

    function drawMonopolyBorder(cx, cy) {
        const outerSize = boardSize;
        const borderWidth = boardSize * 0.12;
        const cornerSize = borderWidth;
        const propertiesPerSide = 9;
        const propertyWidth = (outerSize - 2 * cornerSize) / propertiesPerSide;
        const colors = ['#FF6B6B', '#FFA500', '#FFFF00', '#90EE90', '#00CED1', '#4169E1', '#9370DB', '#FF69B4'];
        for (let side = 0; side < 4; side++) {
            for (let i = 0; i < propertiesPerSide; i++) {
                const color = colors[(side * 2 + Math.floor(i / 3)) % colors.length];
                drawPropertySpace(boardCtx, cx, cy, side, i, outerSize, borderWidth, cornerSize, propertyWidth, color);
            }
        }
        drawCorners(boardCtx, cx, cy, outerSize, cornerSize);
    }

    function drawPropertySpace(ctx, cx, cy, side, index, bSize, borderWidth, cornerSize, propertyWidth, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(side * Math.PI / 2);
        const x = -bSize / 2 + cornerSize + index * propertyWidth;
        const y = -bSize / 2;
        ctx.fillStyle = '#FFFAF0';
        ctx.fillRect(x, y, propertyWidth - 2, borderWidth - 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, propertyWidth - 2, borderWidth - 2);
        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y + 2, propertyWidth - 6, borderWidth * 0.25);
        ctx.restore();
    }

    function drawCorners(ctx, cx, cy, bSize, cornerSize) {
        const corners = [
            { x: -bSize / 2, y: -bSize / 2, label: 'GO' },
            { x: bSize / 2 - cornerSize, y: -bSize / 2, label: 'JAIL' },
            { x: bSize / 2 - cornerSize, y: bSize / 2 - cornerSize, label: 'FREE' },
            { x: -bSize / 2, y: bSize / 2 - cornerSize, label: 'GO TO' }
        ];
        for (let i = 0; i < corners.length; i++) {
            const corner = corners[i];
            ctx.fillStyle = '#FFFAF0';
            ctx.fillRect(cx + corner.x, cy + corner.y, cornerSize, cornerSize);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx + corner.x, cy + corner.y, cornerSize, cornerSize);
            ctx.fillStyle = '#333';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(corner.label, cx + corner.x + cornerSize / 2, cy + corner.y + cornerSize / 2);
        }
    }

    function drawCenterDiamond(cx, cy, st) {
        const diamondSize = boardSize * 0.35;
        boardCtx.save();
        boardCtx.translate(cx, cy);
        boardCtx.rotate(Math.PI / 4);
        const quadrantSize = diamondSize / Math.sqrt(2);
        const positions = [
            { team: 1, x: -quadrantSize, y: -quadrantSize },
            { team: 2, x: 0, y: -quadrantSize },
            { team: 3, x: -quadrantSize, y: 0 },
            { team: 4, x: 0, y: 0 }
        ];
        for (let p = 0; p < positions.length; p++) {
            const pos = positions[p];
            const color = TEAM_COLORS[pos.team];
            const garden = st.gardens[pos.team];
            boardCtx.fillStyle = hexToRgba(color, 0.7);
            boardCtx.fillRect(pos.x, pos.y, quadrantSize, quadrantSize);
            boardCtx.strokeStyle = hexToRgba(color, 1);
            boardCtx.lineWidth = 3;
            boardCtx.strokeRect(pos.x, pos.y, quadrantSize, quadrantSize);
            drawMiniGarden(boardCtx, pos.x + quadrantSize / 2, pos.y + quadrantSize / 2, quadrantSize * 0.6, garden);
            boardCtx.save();
            boardCtx.rotate(-Math.PI / 4);
            boardCtx.fillStyle = '#fff';
            boardCtx.font = 'bold 14px Arial';
            boardCtx.textAlign = 'center';
            boardCtx.textBaseline = 'middle';
            const labelX = (pos.x + quadrantSize / 2) * Math.cos(-Math.PI / 4) - (pos.y + quadrantSize * 0.15) * Math.sin(-Math.PI / 4);
            const labelY = (pos.x + quadrantSize / 2) * Math.sin(-Math.PI / 4) + (pos.y + quadrantSize * 0.15) * Math.cos(-Math.PI / 4);
            boardCtx.fillText(TEAM_NAMES[pos.team], labelX, labelY);
            boardCtx.restore();
        }
        boardCtx.restore();
        boardCtx.fillStyle = '#fff';
        boardCtx.font = 'bold 20px Arial';
        boardCtx.textAlign = 'center';
        boardCtx.textBaseline = 'middle';
        boardCtx.shadowColor = 'rgba(0,0,0,0.5)';
        boardCtx.shadowBlur = 4;
        boardCtx.fillText('HARVEST', cx, cy - 10);
        boardCtx.font = '14px Arial';
        boardCtx.fillText('Click to Enter', cx, cy + 15);
        boardCtx.shadowBlur = 0;
    }

    function drawMiniGarden(ctx, x, y, size, garden) {
        const plotSize = size / 4;
        const startX = x - size / 2;
        const startY = y - size / 2;
        const stageColors = ['#5D4037', '#6D4C41', '#7CB342', '#8BC34A', '#9CCC65'];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const plotIndex = row * 4 + col;
                const plot = garden.plots[plotIndex];
                const px = startX + col * plotSize;
                const py = startY + row * plotSize;
                ctx.fillStyle = stageColors[plot.stage];
                ctx.fillRect(px + 1, py + 1, plotSize - 2, plotSize - 2);
            }
        }
    }

    // ==================== GARDEN ====================
    let gardenCanvas, gardenCtx;
    let plotAnimations = {};
    const PLOT_COLORS = { 0: '#5D4037', 1: '#6D4C41', 2: '#7CB342', 3: '#8BC34A', 4: '#9CCC65' };
    const PLANT_EMOJIS = ['', '🌱', '🌿', '🌾', '🌻'];

    function initGarden(canvas) {
        gardenCanvas = canvas;
        gardenCtx = canvas.getContext('2d');
        resizeGardenCanvas();
        window.addEventListener('resize', resizeGardenCanvas);
    }

    function resizeGardenCanvas() {
        const container = gardenCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        const size = Math.min(rect.width - 40, rect.height * 0.6, 500);
        gardenCanvas.width = size;
        gardenCanvas.height = size;
        renderGarden();
    }

    function renderGarden() {
        const st = getState();
        const garden = st.gardens[st.selectedTeam];
        gardenCtx.clearRect(0, 0, gardenCanvas.width, gardenCanvas.height);
        const padding = 20;
        const gridSize = gardenCanvas.width - padding * 2;
        const plotSize = gridSize / 4;
        gardenCtx.fillStyle = '#3E2723';
        drawRoundedRect(gardenCtx, padding / 2, padding / 2, gridSize + padding, gridSize + padding, 15);
        gardenCtx.fill();
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const plotIndex = row * 4 + col;
                const plot = garden.plots[plotIndex];
                const x = padding + col * plotSize;
                const y = padding + row * plotSize;
                drawPlot(x, y, plotSize, plot, plotIndex);
            }
        }
        drawGridLabels(padding, plotSize);
    }

    function drawPlot(x, y, size, plot, index) {
        const gap = 4;
        const plotX = x + gap;
        const plotY = y + gap;
        const plotWidth = size - gap * 2;
        const plotHeight = size - gap * 2 - 15;
        const anim = plotAnimations[index];
        let scale = 1;
        let glow = 0;
        if (anim) {
            const progress = (Date.now() - anim.startTime) / anim.duration;
            if (progress >= 1) {
                delete plotAnimations[index];
            } else {
                scale = 1 + Math.sin(progress * Math.PI) * 0.1;
                glow = Math.sin(progress * Math.PI) * 20;
            }
        }
        gardenCtx.save();
        const centerX = plotX + plotWidth / 2;
        const centerY = plotY + plotHeight / 2;
        gardenCtx.translate(centerX, centerY);
        gardenCtx.scale(scale, scale);
        gardenCtx.translate(-centerX, -centerY);
        if (glow > 0) {
            gardenCtx.shadowColor = '#FFD700';
            gardenCtx.shadowBlur = glow;
        }
        gardenCtx.fillStyle = PLOT_COLORS[plot.stage];
        drawRoundedRect(gardenCtx, plotX, plotY, plotWidth, plotHeight, 8);
        gardenCtx.fill();
        gardenCtx.strokeStyle = '#2E1B0F';
        gardenCtx.lineWidth = 2;
        gardenCtx.stroke();
        gardenCtx.shadowBlur = 0;
        if (plot.stage > 0) {
            gardenCtx.font = (plotWidth * 0.5) + 'px Arial';
            gardenCtx.textAlign = 'center';
            gardenCtx.textBaseline = 'middle';
            gardenCtx.fillText(PLANT_EMOJIS[plot.stage], centerX, centerY);
        }
        const row = Math.floor(index / 4) + 1;
        const col = (index % 4) + 1;
        gardenCtx.fillStyle = 'rgba(255,255,255,0.3)';
        gardenCtx.font = '10px Arial';
        gardenCtx.textAlign = 'left';
        gardenCtx.textBaseline = 'top';
        gardenCtx.fillText(row + ',' + col, plotX + 4, plotY + 4);
        gardenCtx.restore();
        const barX = plotX;
        const barY = plotY + plotHeight + 4;
        const barWidth = plotWidth;
        const barHeight = 8;
        gardenCtx.fillStyle = '#1a1a1a';
        drawRoundedRect(gardenCtx, barX, barY, barWidth, barHeight, 4);
        gardenCtx.fill();
        const fillWidth = (plot.xp / 100) * barWidth;
        if (fillWidth > 0) {
            gardenCtx.fillStyle = getXPBarColor(plot.xp);
            drawRoundedRect(gardenCtx, barX, barY, Math.max(fillWidth, 8), barHeight, 4);
            gardenCtx.fill();
        }
        gardenCtx.fillStyle = '#fff';
        gardenCtx.font = 'bold 7px Arial';
        gardenCtx.textAlign = 'center';
        gardenCtx.textBaseline = 'middle';
        gardenCtx.fillText(plot.xp + '', barX + barWidth / 2, barY + barHeight / 2);
    }

    function getXPBarColor(xp) {
        if (xp >= 100) return '#FFD700';
        if (xp >= 75) return '#FFA500';
        if (xp >= 50) return '#90EE90';
        if (xp >= 25) return '#4CAF50';
        return '#2E7D32';
    }

    function drawGridLabels(padding, plotSize) {
        gardenCtx.fillStyle = 'rgba(255,255,255,0.6)';
        gardenCtx.font = 'bold 14px Arial';
        gardenCtx.textAlign = 'right';
        gardenCtx.textBaseline = 'middle';
        for (let i = 0; i < 4; i++) {
            const y = padding + i * plotSize + plotSize / 2;
            gardenCtx.fillText((i + 1).toString(), padding - 8, y);
        }
        gardenCtx.textAlign = 'center';
        gardenCtx.textBaseline = 'bottom';
        for (let i = 0; i < 4; i++) {
            const x = padding + i * plotSize + plotSize / 2;
            gardenCtx.fillText((i + 1).toString(), x, padding - 5);
        }
    }

    function animatePlot(index) {
        plotAnimations[index] = { startTime: Date.now(), duration: 500 };
        function animate() {
            if (plotAnimations[index]) {
                renderGarden();
                requestAnimationFrame(animate);
            }
        }
        requestAnimationFrame(animate);
    }

    function animateMultiplePlots(indices) {
        for (let i = 0; i < indices.length; i++) {
            (function(idx, delay) {
                setTimeout(function() { animatePlot(idx); }, delay);
            })(indices[i], i * 50);
        }
    }

    function animateAllPlots() {
        for (let i = 0; i < 16; i++) {
            (function(idx, delay) {
                setTimeout(function() { animatePlot(idx); }, delay);
            })(i, i * 30);
        }
    }

    // ==================== DICE ====================
    const DIE_FACES = [1, 2, 3, 4, '2x'];
    let die1Element, die2Element, rollBtn, resultElement;
    let isRolling = false;

    function initDice(die1El, die2El, rollBtnEl, resultEl) {
        die1Element = die1El;
        die2Element = die2El;
        rollBtn = rollBtnEl;
        resultElement = resultEl;
        rollBtn.addEventListener('click', handleRoll);
    }

    function updateDiceButton() {
        const st = getState();
        rollBtn.disabled = st.seeds < 1 || isRolling;
        if (st.seeds < 1) {
            rollBtn.textContent = 'No Seeds!';
        } else {
            rollBtn.textContent = 'Roll Dice (1 Seed)';
        }
    }

    function handleRoll() {
        const st = getState();
        if (st.seeds < 1 || isRolling) return;
        if (!consumeSeeds(1)) return;
        isRolling = true;
        updateDiceButton();
        resultElement.textContent = 'Rolling...';
        playDiceRoll();
        die1Element.classList.add('rolling');
        die2Element.classList.add('rolling');
        const animateInterval = setInterval(function() {
            die1Element.textContent = DIE_FACES[randomInt(0, 4)];
            die2Element.textContent = DIE_FACES[randomInt(0, 4)];
        }, 50);
        setTimeout(function() {
            clearInterval(animateInterval);
            const roll1 = DIE_FACES[randomInt(0, 4)];
            const roll2 = DIE_FACES[randomInt(0, 4)];
            die1Element.textContent = roll1;
            die2Element.textContent = roll2;
            die1Element.classList.remove('rolling');
            die2Element.classList.remove('rolling');
            die1Element.classList.toggle('double', roll1 === '2x');
            die2Element.classList.toggle('double', roll2 === '2x');
            playDiceLand();
            setTimeout(function() {
                const result = processRoll(roll1, roll2);
                isRolling = false;
                updateDiceButton();
                handleRollComplete(result);
            }, 200);
        }, 800);
    }

    function processRoll(roll1, roll2) {
        const st = getState();
        const team = st.selectedTeam;
        const XP_GAIN = 15;
        let result = { die1: roll1, die2: roll2, type: '', affectedPlots: [], message: '' };
        if (roll1 === '2x' && roll2 === '2x') {
            result.type = 'fullBoard';
            result.message = 'JACKPOT! XP to ALL plots!';
            result.affectedPlots = [];
            for (let i = 0; i < 16; i++) result.affectedPlots.push(i);
            addXPToAllPlots(team, XP_GAIN);
            playFullBoardFanfare();
        } else if (roll1 === '2x') {
            const col = roll2 - 1;
            result.type = 'column';
            result.message = 'Column ' + roll2 + ' planted!';
            result.affectedPlots = [col, col + 4, col + 8, col + 12];
            for (let i = 0; i < result.affectedPlots.length; i++) {
                updateGardenPlot(team, result.affectedPlots[i], XP_GAIN);
            }
            playRowHit();
        } else if (roll2 === '2x') {
            const row = roll1 - 1;
            result.type = 'row';
            result.message = 'Row ' + roll1 + ' planted!';
            result.affectedPlots = [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3];
            for (let i = 0; i < result.affectedPlots.length; i++) {
                updateGardenPlot(team, result.affectedPlots[i], XP_GAIN);
            }
            playRowHit();
        } else {
            const row = roll1 - 1;
            const col = roll2 - 1;
            const plotIndex = row * 4 + col;
            result.type = 'single';
            result.message = 'Planted at (' + roll1 + ', ' + roll2 + ')!';
            result.affectedPlots = [plotIndex];
            updateGardenPlot(team, plotIndex, XP_GAIN);
            playPlotHit();
        }
        resultElement.textContent = result.message;
        return result;
    }

    function handleRollComplete(result) {
        if (result.type === 'fullBoard') {
            animateAllPlots();
        } else if (result.type === 'row' || result.type === 'column') {
            animateMultiplePlots(result.affectedPlots);
        } else {
            for (let i = 0; i < result.affectedPlots.length; i++) {
                animatePlot(result.affectedPlots[i]);
            }
        }
        renderGarden();
    }

    // ==================== HUD ====================
    let hudElement, badgeElement, seedCountElement, timerElement, haystackSeedElement;
    let timerInterval = null;
    let onBadgeClickCallback = null;

    function initHUD(hudEl, onBadgeClick) {
        hudElement = hudEl;
        badgeElement = document.getElementById('hud-badge');
        seedCountElement = document.getElementById('hud-seed-count');
        timerElement = document.getElementById('hud-timer');
        haystackSeedElement = document.getElementById('seed-count');
        onBadgeClickCallback = onBadgeClick;
        badgeElement.addEventListener('click', function() {
            if (onBadgeClickCallback) onBadgeClickCallback();
        });
        subscribeState(updateHUD);
        startTimerLoop();
        updateHUD(getState());
    }

    function startTimerLoop() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
    }

    function updateTimer() {
        const remaining = getTimerRemaining();
        timerElement.textContent = formatTime(remaining);
        const bonusSeeds = checkTimerExpired();
        if (bonusSeeds > 0) {
            playTimerComplete();
            showBonusNotification(bonusSeeds);
        }
        const hours = remaining / (1000 * 60 * 60);
        if (hours < 1) {
            timerElement.style.color = '#e74c3c';
        } else if (hours < 3) {
            timerElement.style.color = '#f39c12';
        } else {
            timerElement.style.color = '#3498db';
        }
    }

    function updateHUD(st) {
        if (seedCountElement) seedCountElement.textContent = st.seeds;
        if (haystackSeedElement) haystackSeedElement.textContent = st.seeds;
        updateTimer();
    }

    function showHUD() {
        hudElement.classList.remove('hud-hidden');
        hudElement.classList.add('hud-visible');
    }

    function hideHUD() {
        hudElement.classList.remove('hud-visible');
        hudElement.classList.add('hud-hidden');
    }

    function showBonusNotification(seeds) {
        const notification = document.createElement('div');
        notification.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(145deg,#27ae60,#2ecc71);color:white;padding:20px 40px;border-radius:15px;font-size:1.5em;font-weight:bold;z-index:1000;box-shadow:0 10px 30px rgba(0,0,0,0.3);';
        notification.innerHTML = '🌾 +' + seeds + ' Seeds! 🌾';
        document.body.appendChild(notification);
        setTimeout(function() {
            notification.style.transition = 'opacity 0.5s';
            notification.style.opacity = '0';
            setTimeout(function() { notification.remove(); }, 500);
        }, 2000);
    }

    // ==================== MAIN ====================
    function navigateToGarden() {
        playClick();
        playSwoosh();
        setState({ currentView: 'garden' });
        showGardenView();
    }

    function navigateToBoard() {
        playClick();
        playSwoosh();
        setState({ currentView: 'board' });
        showBoardView();
    }

    function showBoardView() {
        document.getElementById('board-view').classList.add('active');
        document.getElementById('garden-view').classList.remove('active');
        showHUD();
        renderBoard();
    }

    function showGardenView() {
        document.getElementById('board-view').classList.remove('active');
        document.getElementById('garden-view').classList.add('active');
        hideHUD();
        renderGarden();
        updateDiceButton();
    }

    function init() {
        initState();
        document.addEventListener('click', function() { initAudio(); }, { once: true });
        document.addEventListener('touchstart', function() { initAudio(); }, { once: true });
        initBoard(document.getElementById('board-canvas'), navigateToGarden);
        initGarden(document.getElementById('garden-canvas'));
        initDice(
            document.getElementById('die1'),
            document.getElementById('die2'),
            document.getElementById('roll-btn'),
            document.getElementById('roll-result')
        );
        initHUD(document.getElementById('hud'), navigateToGarden);
        document.getElementById('back-btn').addEventListener('click', navigateToBoard);
        subscribeState(function(st) {
            if (st.currentView === 'board') {
                renderBoard();
            } else {
                renderGarden();
            }
            updateDiceButton();
        });
        const st = getState();
        if (st.currentView === 'garden') {
            showGardenView();
        } else {
            showBoardView();
        }
        console.log('Harvest Festival initialized!');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
