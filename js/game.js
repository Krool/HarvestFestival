// Harvest Festival - Single File Build (Monopoly Go Style)
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
        return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
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
            coins: 0,
            wins: 0,
            timerEnd: now + TIMER_DURATION,
            currentView: 'board',
            selectedTeam: 1,
            totalXP: 0,
            needsHarvest: false,
            multiplier: 1,
            gardens: {
                1: createGarden(),
                2: createGarden(),
                3: createGarden(),
                4: createGarden()
            },
            boardOffset: { x: 0, y: 0 },
            haystackPoints: 0,
            harvestCount: 0,
            maxHarvests: 8,
            otherTeamProgress: { 2: 0, 3: 0, 4: 0 }
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
                if (!state.totalXP) state.totalXP = 0;
                if (!state.coins) state.coins = 0;
                if (!state.wins) state.wins = 0;
                if (state.needsHarvest === undefined) state.needsHarvest = false;
                if (!state.multiplier) state.multiplier = 1;
                if (state.haystackPoints === undefined) state.haystackPoints = 0;
                if (state.harvestCount === undefined) state.harvestCount = 0;
                if (state.maxHarvests === undefined) state.maxHarvests = 8;
                if (!state.otherTeamProgress) state.otherTeamProgress = { 2: 0, 3: 0, 4: 0 };
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

    const MAX_PLOT_XP = 1000;

    function updateGardenPlot(team, plotIndex, xpGain) {
        const garden = state.gardens[team];
        const plot = garden.plots[plotIndex];
        const actualGain = Math.min(MAX_PLOT_XP - plot.xp, xpGain);
        plot.xp = Math.min(MAX_PLOT_XP, plot.xp + xpGain);
        plot.stage = getStageFromXP(plot.xp);
        state.totalXP += actualGain;
        saveState();
        notifyStateListeners();
        return plot;
    }

    function addXPToAllPlots(team, xpGain) {
        const garden = state.gardens[team];
        for (let i = 0; i < garden.plots.length; i++) {
            const plot = garden.plots[i];
            const actualGain = Math.min(MAX_PLOT_XP - plot.xp, xpGain);
            plot.xp = Math.min(MAX_PLOT_XP, plot.xp + xpGain);
            plot.stage = getStageFromXP(plot.xp);
            state.totalXP += actualGain;
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
        if (xp >= 1000) return 4;
        if (xp >= 750) return 3;
        if (xp >= 500) return 2;
        if (xp >= 250) return 1;
        return 0;
    }

    function getXPForNextStage(xp) {
        if (xp >= 1000) return { current: 1000, next: 1000, progress: 100 };
        if (xp >= 750) return { current: xp - 750, next: 250, progress: (xp - 750) / 250 * 100 };
        if (xp >= 500) return { current: xp - 500, next: 250, progress: (xp - 500) / 250 * 100 };
        if (xp >= 250) return { current: xp - 250, next: 250, progress: (xp - 250) / 250 * 100 };
        return { current: xp, next: 250, progress: xp / 250 * 100 };
    }

    function cycleMultiplier() {
        const multipliers = [1, 3, 5, 10];
        const currentIndex = multipliers.indexOf(state.multiplier);
        const nextIndex = (currentIndex + 1) % multipliers.length;
        state.multiplier = multipliers[nextIndex];
        saveState();
        notifyStateListeners();
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

    function getTotalProgress() {
        let total = 0;
        for (let t = 1; t <= 4; t++) {
            for (let i = 0; i < 16; i++) {
                total += state.gardens[t].plots[i].xp;
            }
        }
        return total;
    }

    function checkGardenFull(team) {
        const garden = state.gardens[team];
        for (let i = 0; i < garden.plots.length; i++) {
            if (garden.plots[i].xp < MAX_PLOT_XP) return false;
        }
        return true;
    }

    function getGardenTotalXP(team) {
        const garden = state.gardens[team];
        let total = 0;
        for (let i = 0; i < garden.plots.length; i++) {
            total += garden.plots[i].xp;
        }
        return total;
    }

    function setNeedsHarvest(value) {
        state.needsHarvest = value;
        saveState();
        notifyStateListeners();
    }

    function clearGarden(team) {
        const garden = state.gardens[team];
        for (let i = 0; i < garden.plots.length; i++) {
            garden.plots[i].xp = 0;
            garden.plots[i].stage = 0;
        }
        saveState();
        notifyStateListeners();
    }

    function addCoins(amount) {
        state.coins += amount;
        saveState();
        notifyStateListeners();
    }

    function addSeeds(amount) {
        state.seeds += amount;
        saveState();
        notifyStateListeners();
    }

    function addWin() {
        state.wins = (state.wins || 0) + 1;
        saveState();
        notifyStateListeners();
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
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
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
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
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
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
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
            gain.gain.setValueAtTime(0.12, startTime);
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
            gain.gain.setValueAtTime(0.15, startTime);
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
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.setValueAtTime(0.12, startTime + 0.2);
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
        finalGain.gain.setValueAtTime(0.15, ctx.currentTime + 0.75);
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
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        }
    }

    function playSwoosh() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const bufferSize = ctx.sampleRate * 0.15;
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
        filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.07);
        filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.15);
        filter.Q.setValueAtTime(1, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.15);
    }

    function playHarvestChime() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        for (let i = 0; i < notes.length; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(ctx.destination);
            const startTime = ctx.currentTime + i * 0.1;
            osc.frequency.setValueAtTime(notes[i], startTime);
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        }
    }

    function playCoinCollect() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
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
    let dragStartPos = { x: 0, y: 0 };
    let lastDragPos = { x: 0, y: 0 };
    let totalDragDistance = 0;
    let boardSize = 600;
    const DRAG_THRESHOLD = 10;

    function initBoard(canvas) {
        boardCanvas = canvas;
        boardCtx = canvas.getContext('2d');

        resizeBoardCanvas();
        window.addEventListener('resize', resizeBoardCanvas);

        canvas.addEventListener('mousedown', handleBoardDragStart);
        canvas.addEventListener('mousemove', handleBoardDragMove);
        canvas.addEventListener('mouseup', handleBoardDragEnd);
        canvas.addEventListener('mouseleave', handleBoardDragEnd);

        canvas.addEventListener('touchstart', handleBoardTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleBoardTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleBoardTouchEnd);
    }

    function resizeBoardCanvas() {
        const wrapper = document.getElementById('board-wrapper');
        const rect = wrapper.getBoundingClientRect();
        boardCanvas.width = rect.width;
        boardCanvas.height = rect.height;
        boardSize = Math.min(rect.width, rect.height) * 1.4;
        renderBoard();
    }

    function handleBoardDragStart(e) {
        isDragging = true;
        dragStartPos = { x: e.clientX, y: e.clientY };
        lastDragPos = { x: e.clientX, y: e.clientY };
        totalDragDistance = 0;
    }

    function handleBoardTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            isDragging = true;
            dragStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            lastDragPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            totalDragDistance = 0;
        }
    }

    function handleBoardDragMove(e) {
        if (!isDragging) return;
        const st = getState();
        const dx = e.clientX - lastDragPos.x;
        const dy = e.clientY - lastDragPos.y;
        totalDragDistance += Math.sqrt(dx * dx + dy * dy);
        const maxOffset = boardSize / 4;
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
        totalDragDistance += Math.sqrt(dx * dx + dy * dy);
        const maxOffset = boardSize / 4;
        const newOffset = {
            x: clamp(st.boardOffset.x + dx, -maxOffset, maxOffset),
            y: clamp(st.boardOffset.y + dy, -maxOffset, maxOffset)
        };
        setState({ boardOffset: newOffset });
        lastDragPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        renderBoard();
    }

    function handleBoardDragEnd(e) {
        // Check if it was a tap (not a drag)
        if (totalDragDistance < DRAG_THRESHOLD) {
            checkCenterClick(e.clientX, e.clientY);
        }
        isDragging = false;
    }

    function handleBoardTouchEnd(e) {
        // Check if it was a tap (not a drag)
        if (totalDragDistance < DRAG_THRESHOLD && e.changedTouches && e.changedTouches.length > 0) {
            checkCenterClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }
        isDragging = false;
    }

    function checkCenterClick(clientX, clientY) {
        const st = getState();
        const rect = boardCanvas.getBoundingClientRect();
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Calculate center of the visible board
        const centerX = boardCanvas.width / 2 + st.boardOffset.x;
        const centerY = boardCanvas.height / 2 + st.boardOffset.y;

        // Check if click is within center area (accounting for 45 degree rotation)
        const dx = canvasX - centerX;
        const dy = canvasY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Center clickable area radius (about half the quadrant area)
        const centerRadius = boardSize * 0.2;

        if (distance < centerRadius) {
            navigateToGarden();
        }
    }

    function renderBoard() {
        const st = getState();
        boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

        const centerX = boardCanvas.width / 2 + st.boardOffset.x;
        const centerY = boardCanvas.height / 2 + st.boardOffset.y;

        // Save and rotate entire board 45 degrees for isometric view
        boardCtx.save();
        boardCtx.translate(centerX, centerY);
        boardCtx.rotate(Math.PI / 4);
        boardCtx.translate(-centerX, -centerY);

        drawBoardBackground(centerX, centerY);
        drawMonopolyBorder(centerX, centerY);

        boardCtx.restore();

        // Draw center content
        drawCenterArea(centerX, centerY, st);
    }

    function drawBoardBackground(cx, cy) {
        // Outer board
        boardCtx.fillStyle = '#DEB887';
        drawRoundedRect(boardCtx, cx - boardSize / 2, cy - boardSize / 2, boardSize, boardSize, 15);
        boardCtx.fill();

        // Inner area
        boardCtx.fillStyle = '#C8E6C9';
        const innerSize = boardSize * 0.76;
        drawRoundedRect(boardCtx, cx - innerSize / 2, cy - innerSize / 2, innerSize, innerSize, 10);
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
        ctx.fillRect(x, y, propertyWidth - 1, borderWidth - 1);
        ctx.strokeStyle = '#8B7355';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, propertyWidth - 1, borderWidth - 1);
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, propertyWidth - 3, borderWidth * 0.28);
        ctx.restore();
    }

    function drawCorners(ctx, cx, cy, bSize, cornerSize) {
        const corners = [
            { x: -bSize / 2, y: -bSize / 2, label: 'GO', color: '#FF6B35' },
            { x: bSize / 2 - cornerSize, y: -bSize / 2, label: 'JAIL', color: '#FFA500' },
            { x: bSize / 2 - cornerSize, y: bSize / 2 - cornerSize, label: 'FREE', color: '#4CAF50' },
            { x: -bSize / 2, y: bSize / 2 - cornerSize, label: '???', color: '#9C27B0' }
        ];
        for (let i = 0; i < corners.length; i++) {
            const corner = corners[i];
            ctx.fillStyle = corner.color;
            ctx.fillRect(cx + corner.x, cy + corner.y, cornerSize, cornerSize);
            ctx.strokeStyle = '#5D4037';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx + corner.x, cy + corner.y, cornerSize, cornerSize);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(corner.label, cx + corner.x + cornerSize / 2, cy + corner.y + cornerSize / 2);
        }
    }

    function drawCenterArea(cx, cy, st) {
        const centerDiamondSize = boardSize * 0.38;

        boardCtx.save();
        boardCtx.translate(cx, cy);

        // Draw the center diamond outline
        boardCtx.strokeStyle = '#8D6E63';
        boardCtx.lineWidth = 2;
        boardCtx.beginPath();
        boardCtx.moveTo(0, -centerDiamondSize);
        boardCtx.lineTo(centerDiamondSize, 0);
        boardCtx.lineTo(0, centerDiamondSize);
        boardCtx.lineTo(-centerDiamondSize, 0);
        boardCtx.closePath();
        boardCtx.stroke();

        // Team quadrants - each is a diamond taking 1/4 of the center
        // Top, Right, Bottom, Left
        const quadrants = [
            { team: 1, points: [[0, -centerDiamondSize], [centerDiamondSize * 0.5, -centerDiamondSize * 0.5], [0, 0], [-centerDiamondSize * 0.5, -centerDiamondSize * 0.5]] },
            { team: 2, points: [[centerDiamondSize, 0], [centerDiamondSize * 0.5, centerDiamondSize * 0.5], [0, 0], [centerDiamondSize * 0.5, -centerDiamondSize * 0.5]] },
            { team: 3, points: [[0, centerDiamondSize], [-centerDiamondSize * 0.5, centerDiamondSize * 0.5], [0, 0], [centerDiamondSize * 0.5, centerDiamondSize * 0.5]] },
            { team: 4, points: [[-centerDiamondSize, 0], [-centerDiamondSize * 0.5, -centerDiamondSize * 0.5], [0, 0], [-centerDiamondSize * 0.5, centerDiamondSize * 0.5]] }
        ];

        for (let q = 0; q < quadrants.length; q++) {
            const quad = quadrants[q];
            const color = TEAM_COLORS[quad.team];
            const garden = st.gardens[quad.team];
            const pts = quad.points;

            // Draw diamond quadrant
            boardCtx.beginPath();
            boardCtx.moveTo(pts[0][0], pts[0][1]);
            boardCtx.lineTo(pts[1][0], pts[1][1]);
            boardCtx.lineTo(pts[2][0], pts[2][1]);
            boardCtx.lineTo(pts[3][0], pts[3][1]);
            boardCtx.closePath();
            boardCtx.fillStyle = hexToRgba(color, 0.85);
            boardCtx.fill();
            boardCtx.strokeStyle = hexToRgba(color, 1);
            boardCtx.lineWidth = 2;
            boardCtx.stroke();

            // Calculate center of this quadrant (excluding the center point)
            const quadCenterX = (pts[0][0] + pts[1][0] + pts[3][0]) / 3;
            const quadCenterY = (pts[0][1] + pts[1][1] + pts[3][1]) / 3;

            // Mini garden in outer half of quadrant
            const gardenSize = centerDiamondSize * 0.28;
            const gardenOffsetX = quadCenterX * 0.7;
            const gardenOffsetY = quadCenterY * 0.7;
            drawMiniGarden(boardCtx, gardenOffsetX, gardenOffsetY, gardenSize, garden);

            // Haystack near center
            const haystackOffsetX = quadCenterX * 0.25;
            const haystackOffsetY = quadCenterY * 0.25;
            boardCtx.font = '14px Arial';
            boardCtx.textAlign = 'center';
            boardCtx.textBaseline = 'middle';
            boardCtx.fillText('🌾', haystackOffsetX, haystackOffsetY);

            // Team label
            boardCtx.fillStyle = '#fff';
            boardCtx.font = 'bold 9px Arial';
            boardCtx.shadowColor = 'rgba(0,0,0,0.7)';
            boardCtx.shadowBlur = 2;
            boardCtx.fillText(TEAM_NAMES[quad.team], quadCenterX * 0.45, quadCenterY * 0.45 + 12);
            boardCtx.shadowBlur = 0;
        }

        // Small center decoration
        boardCtx.fillStyle = 'rgba(139,69,19,0.9)';
        boardCtx.beginPath();
        boardCtx.arc(0, 0, 12, 0, Math.PI * 2);
        boardCtx.fill();
        boardCtx.font = '10px Arial';
        boardCtx.fillText('🎲', 0, 1);

        boardCtx.restore();
    }

    function drawMiniGarden(ctx, x, y, size, garden) {
        const plotSize = size / 4;
        const startX = x - size / 2;
        const startY = y - size / 2;
        const stageColors = ['#5D4037', '#6D4C41', '#7CB342', '#8BC34A', '#9CCC65'];
        const plantEmojis = ['', '🌱', '🌿', '🌾', '🌻'];

        ctx.fillStyle = '#3E2723';
        drawRoundedRect(ctx, startX - 1, startY - 1, size + 2, size + 2, 3);
        ctx.fill();

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const plotIndex = row * 4 + col;
                const plot = garden.plots[plotIndex];
                const px = startX + col * plotSize;
                const py = startY + row * plotSize;
                ctx.fillStyle = stageColors[plot.stage];
                ctx.fillRect(px + 0.5, py + 0.5, plotSize - 1, plotSize - 1);

                // Draw plant emoji if stage > 0
                if (plot.stage > 0) {
                    ctx.font = (plotSize * 0.7) + 'px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(plantEmojis[plot.stage], px + plotSize / 2, py + plotSize / 2);
                }
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
        const wrapper = document.getElementById('garden-wrapper');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        // Optimized for iPhone portrait - use more of the available width
        const maxSize = Math.min(rect.width - 16, rect.height - 16, 340);
        gardenCanvas.width = maxSize;
        gardenCanvas.height = maxSize;
        renderGarden();
    }

    function renderGarden() {
        const st = getState();
        const garden = st.gardens[st.selectedTeam];
        gardenCtx.clearRect(0, 0, gardenCanvas.width, gardenCanvas.height);

        const padding = 12;
        const gridSize = gardenCanvas.width - padding * 2;
        const plotSize = gridSize / 4;

        gardenCtx.fillStyle = '#3E2723';
        drawRoundedRect(gardenCtx, padding / 2, padding / 2, gridSize + padding, gridSize + padding, 10);
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
        const gap = 2;
        const plotX = x + gap;
        const plotY = y + gap;
        const plotWidth = size - gap * 2;
        const plotHeight = size - gap * 2 - 10;

        const anim = plotAnimations[index];
        let scale = 1;
        let glow = 0;
        if (anim) {
            const progress = (Date.now() - anim.startTime) / anim.duration;
            if (progress >= 1) {
                delete plotAnimations[index];
            } else {
                scale = 1 + Math.sin(progress * Math.PI) * 0.1;
                glow = Math.sin(progress * Math.PI) * 15;
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
        drawRoundedRect(gardenCtx, plotX, plotY, plotWidth, plotHeight, 5);
        gardenCtx.fill();
        gardenCtx.strokeStyle = '#2E1B0F';
        gardenCtx.lineWidth = 1;
        gardenCtx.stroke();
        gardenCtx.shadowBlur = 0;

        if (plot.stage > 0) {
            gardenCtx.font = (plotWidth * 0.4) + 'px Arial';
            gardenCtx.textAlign = 'center';
            gardenCtx.textBaseline = 'middle';
            gardenCtx.fillText(PLANT_EMOJIS[plot.stage], centerX, centerY);
        }

        const row = Math.floor(index / 4) + 1;
        const col = (index % 4) + 1;
        gardenCtx.fillStyle = 'rgba(255,255,255,0.4)';
        gardenCtx.font = 'bold 8px Arial';
        gardenCtx.textAlign = 'left';
        gardenCtx.textBaseline = 'top';
        gardenCtx.fillText(row + ',' + col, plotX + 2, plotY + 1);

        gardenCtx.restore();

        // XP Bar - shows progress to next stage
        const barX = plotX;
        const barY = plotY + plotHeight + 1;
        const barWidth = plotWidth;
        const barHeight = 5;

        gardenCtx.fillStyle = '#1a1a1a';
        drawRoundedRect(gardenCtx, barX, barY, barWidth, barHeight, 2);
        gardenCtx.fill();

        const stageProgress = getXPForNextStage(plot.xp);
        const fillWidth = (stageProgress.progress / 100) * barWidth;
        if (fillWidth > 0) {
            gardenCtx.fillStyle = getXPBarColor(plot.xp);
            drawRoundedRect(gardenCtx, barX, barY, Math.max(fillWidth, 4), barHeight, 2);
            gardenCtx.fill();
        }
    }

    function getXPBarColor(xp) {
        if (xp >= 1000) return '#FFD700';
        if (xp >= 750) return '#FFA500';
        if (xp >= 500) return '#90EE90';
        if (xp >= 250) return '#4CAF50';
        return '#2E7D32';
    }

    function drawGridLabels(padding, plotSize) {
        gardenCtx.fillStyle = 'rgba(255,255,255,0.5)';
        gardenCtx.font = 'bold 10px Arial';
        gardenCtx.textAlign = 'right';
        gardenCtx.textBaseline = 'middle';
        for (let i = 0; i < 4; i++) {
            const y = padding + i * plotSize + plotSize / 2;
            gardenCtx.fillText((i + 1).toString(), padding - 3, y);
        }
        gardenCtx.textAlign = 'center';
        gardenCtx.textBaseline = 'bottom';
        for (let i = 0; i < 4; i++) {
            const x = padding + i * plotSize + plotSize / 2;
            gardenCtx.fillText((i + 1).toString(), x, padding - 2);
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
        const cost = st.multiplier || 1;
        const gardenFull = checkGardenFull(st.selectedTeam);
        rollBtn.disabled = st.seeds < cost || isRolling || st.needsHarvest || gardenFull;

        // Update roll cost display
        const rollCost = document.querySelector('.roll-cost');
        if (rollCost) {
            rollCost.textContent = '-' + cost + ' 🌱';
        }

        // Update multiplier button
        updateMultiplierButton(st);
    }

    function updateMultiplierButton(st) {
        const btn = document.getElementById('multiplier-btn');
        if (!btn) return;

        const mult = st.multiplier || 1;
        btn.textContent = mult + 'x';

        // Update button color based on multiplier
        btn.classList.remove('x3', 'x5', 'x10');
        if (mult === 3) btn.classList.add('x3');
        else if (mult === 5) btn.classList.add('x5');
        else if (mult === 10) btn.classList.add('x10');
    }

    function handleMultiplierClick() {
        playClick();
        cycleMultiplier();
    }

    function handleRoll() {
        const st = getState();
        const cost = st.multiplier || 1;
        if (st.seeds < cost || isRolling) return;
        if (!consumeSeeds(cost)) return;

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
        const multiplier = st.multiplier || 1;
        const XP_GAIN = 15 * multiplier;
        let result = { die1: roll1, die2: roll2, type: '', affectedPlots: [], message: '' };

        if (roll1 === '2x' && roll2 === '2x') {
            result.type = 'fullBoard';
            result.message = 'JACKPOT! All plots +XP!';
            result.affectedPlots = [];
            for (let i = 0; i < 16; i++) result.affectedPlots.push(i);
            addXPToAllPlots(team, XP_GAIN);
            playFullBoardFanfare();
        } else if (roll1 === '2x') {
            const col = roll2 - 1;
            result.type = 'column';
            result.message = 'Column ' + roll2 + '!';
            result.affectedPlots = [col, col + 4, col + 8, col + 12];
            for (let i = 0; i < result.affectedPlots.length; i++) {
                updateGardenPlot(team, result.affectedPlots[i], XP_GAIN);
            }
            playRowHit();
        } else if (roll2 === '2x') {
            const row = roll1 - 1;
            result.type = 'row';
            result.message = 'Row ' + roll1 + '!';
            result.affectedPlots = [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3];
            for (let i = 0; i < result.affectedPlots.length; i++) {
                updateGardenPlot(team, result.affectedPlots[i], XP_GAIN);
            }
            playRowHit();
        } else {
            // Single tile - re-roll if max level
            let row = roll1 - 1;
            let col = roll2 - 1;
            let plotIndex = row * 4 + col;
            const garden = st.gardens[team];

            // If this plot is max level, find a different one
            if (garden.plots[plotIndex].xp >= MAX_PLOT_XP) {
                const availablePlots = [];
                for (let i = 0; i < 16; i++) {
                    if (garden.plots[i].xp < MAX_PLOT_XP) {
                        availablePlots.push(i);
                    }
                }
                if (availablePlots.length > 0) {
                    // Pick a random available plot
                    plotIndex = availablePlots[randomInt(0, availablePlots.length - 1)];
                    row = Math.floor(plotIndex / 4);
                    col = plotIndex % 4;
                    result.message = '(' + (row + 1) + ',' + (col + 1) + ') redirected!';
                } else {
                    // All plots maxed - shouldn't happen often
                    result.message = 'All plots maxed!';
                }
            } else {
                result.message = '(' + roll1 + ',' + roll2 + ')';
            }

            result.type = 'single';
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

    // ==================== UI UPDATE ====================
    function updateAllUI(st) {
        // Top bar seeds
        const topSeeds = document.getElementById('top-seeds');
        if (topSeeds) topSeeds.textContent = st.seeds;

        // Garden seeds
        const gardenSeeds = document.getElementById('garden-seeds');
        if (gardenSeeds) gardenSeeds.textContent = st.seeds;

        // Leaderboard/wins count
        const leaderboardCount = document.getElementById('leaderboard-count');
        if (leaderboardCount) leaderboardCount.textContent = st.wins || 0;

        // Event progress - shows seeds earned (use seeds as progress indicator)
        const progressFill = document.getElementById('event-progress-fill');
        const progressPercent = Math.min(100, (st.seeds / 100) * 100);
        if (progressFill) progressFill.style.width = progressPercent + '%';

        const progressText = document.getElementById('event-progress-text');
        if (progressText) progressText.textContent = st.seeds;

        // Harvest counter
        const harvestNum = (st.harvestCount || 0) + 1;
        const harvestCounter = document.getElementById('harvest-counter');
        if (harvestCounter) {
            harvestCounter.textContent = harvestNum + '/' + st.maxHarvests;
            if (harvestNum >= 7) harvestCounter.style.color = '#FFD700';
        }

        // Garden harvest counter
        const gardenHarvestCounter = document.getElementById('garden-harvest-counter');
        if (gardenHarvestCounter) {
            gardenHarvestCounter.textContent = harvestNum + '/' + st.maxHarvests;
            if (harvestNum >= 7) gardenHarvestCounter.innerHTML = harvestNum + '/' + st.maxHarvests + ' <span style="color:#FFD700">2x!</span>';
        }

        // Timer
        updateTimer();

        // Dice button
        updateDiceButton();

        // Harvest UI state
        updateHarvestUI(st);

        // Haystack display
        updateHaystackDisplay();
    }

    function updateHarvestUI(st) {
        const harvestTrigger = document.getElementById('harvest-trigger-btn');
        const rollBtnArea = document.getElementById('roll-button-area');
        const harvestBtnArea = document.getElementById('harvest-button-area');
        const diceArea = document.getElementById('dice-area');

        // Check if garden has any XP to harvest
        const gardenXP = getGardenTotalXP(st.selectedTeam);
        const hasXPToHarvest = gardenXP > 0;

        if (st.needsHarvest) {
            // Show harvest trigger on board
            if (harvestTrigger) harvestTrigger.classList.remove('hidden');

            // In garden view, show harvest button instead of roll
            if (rollBtnArea) rollBtnArea.classList.add('hidden');
            if (harvestBtnArea) harvestBtnArea.classList.remove('hidden');
            if (diceArea) diceArea.style.opacity = '0.5';
        } else {
            // Hide harvest trigger on board (can still access via garden)
            if (harvestTrigger) harvestTrigger.classList.add('hidden');

            // Show roll button
            if (rollBtnArea) rollBtnArea.classList.remove('hidden');
            if (harvestBtnArea) harvestBtnArea.classList.add('hidden');
            if (diceArea) diceArea.style.opacity = '1';
        }
    }

    function updateTimer() {
        const remaining = getTimerRemaining();
        const timeStr = formatTime(remaining);

        const bannerTimer = document.getElementById('banner-timer');
        if (bannerTimer) bannerTimer.textContent = timeStr;

        const bonusSeeds = checkTimerExpired();
        if (bonusSeeds > 0) {
            playTimerComplete();
            showBonusNotification(bonusSeeds);
        }
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

    // ==================== HARVEST ====================
    let isHarvesting = false;

    function startHarvest() {
        if (isHarvesting) return;
        isHarvesting = true;
        playClick();

        const overlay = document.getElementById('harvest-overlay');
        const progressFill = document.getElementById('harvest-progress-fill');
        const status = document.getElementById('harvest-status');

        overlay.classList.remove('hidden');
        progressFill.style.width = '0%';
        status.textContent = 'Gathering crops...';

        // Animate progress bar
        let progress = 0;
        const harvestInterval = setInterval(function() {
            progress += 2;
            progressFill.style.width = progress + '%';

            if (progress >= 30 && progress < 35) {
                status.textContent = 'Bundling hay...';
                playHarvestChime();
            } else if (progress >= 60 && progress < 65) {
                status.textContent = 'Counting rewards...';
            } else if (progress >= 90 && progress < 95) {
                status.textContent = 'Almost done!';
            }

            if (progress >= 100) {
                clearInterval(harvestInterval);
                completeHarvest(overlay);
            }
        }, 40);
    }

    function completeHarvest(overlay) {
        const st = getState();

        // Calculate points based on plant stages (not XP)
        const garden = st.gardens[st.selectedTeam];
        let totalPoints = 0;
        for (let i = 0; i < garden.plots.length; i++) {
            // Points based on stage: 0=0, 1=10, 2=25, 3=50, 4=100
            const stagePoints = [0, 10, 25, 50, 100];
            totalPoints += stagePoints[garden.plots[i].stage];
        }

        // Last 2 harvests are 2x points
        const harvestNum = st.harvestCount + 1;
        const is2xHarvest = harvestNum >= 7; // Harvests 7 and 8 are 2x
        if (is2xHarvest) {
            totalPoints *= 2;
        }

        playFullBoardFanfare();

        // Hide overlay after short delay
        setTimeout(function() {
            overlay.classList.add('hidden');

            // Fly points to haystack display
            flyPointsToHaystack(totalPoints, is2xHarvest);

            // Harvest other teams too (simulate teammates)
            harvestOtherTeams();

            // Clear garden and reset harvest state
            setTimeout(function() {
                clearGarden(st.selectedTeam);
                setNeedsHarvest(false);

                // Add points to haystack
                st.haystackPoints = (st.haystackPoints || 0) + totalPoints;
                st.harvestCount = (st.harvestCount || 0) + 1;

                // Check if event is complete
                if (st.harvestCount >= st.maxHarvests) {
                    // Event complete - could trigger special reward
                    st.harvestCount = 0;
                    st.haystackPoints = 0;
                }

                saveState();
                addWin();
                isHarvesting = false;
                renderGarden();
                updateAllUI(getState());
            }, 1500);
        }, 500);
    }

    function flyPointsToHaystack(points, is2x) {
        const gardenCanvas = document.getElementById('garden-canvas');
        const haystackArea = document.getElementById('haystack-area');
        if (!gardenCanvas || !haystackArea) return;

        const canvasRect = gardenCanvas.getBoundingClientRect();
        const haystackRect = haystackArea.getBoundingClientRect();

        const startX = canvasRect.left + canvasRect.width / 2;
        const startY = canvasRect.top + canvasRect.height / 2;
        const endX = haystackRect.left + haystackRect.width / 2;
        const endY = haystackRect.top + haystackRect.height / 2;

        // Show floating points text
        const text = (is2x ? '2x ' : '') + '+' + points + ' pts';
        showFloatingText(text, startX, startY, is2x ? '#FFD700' : '#4CAF50');

        // Fly hay icons
        for (let i = 0; i < Math.min(5, Math.ceil(points / 100)); i++) {
            setTimeout(function() {
                const hay = document.createElement('div');
                hay.className = 'flying-reward';
                hay.textContent = '🌾';
                hay.style.left = (startX + (Math.random() - 0.5) * 60) + 'px';
                hay.style.top = (startY + (Math.random() - 0.5) * 60) + 'px';
                document.body.appendChild(hay);

                requestAnimationFrame(function() {
                    hay.style.left = endX + 'px';
                    hay.style.top = endY + 'px';
                    hay.style.opacity = '0';
                    hay.style.transform = 'scale(0.5)';
                });

                setTimeout(function() { hay.remove(); }, 700);
            }, i * 100);
        }
    }

    function updateHaystackDisplay() {
        const st = getState();
        const haystackCount = document.getElementById('haystack-count');
        if (haystackCount) {
            haystackCount.textContent = st.haystackPoints || 0;
        }
    }

    function harvestOtherTeams() {
        const st = getState();
        // Clear other team gardens and show they harvested too
        for (let team = 2; team <= 4; team++) {
            const garden = st.gardens[team];
            for (let i = 0; i < garden.plots.length; i++) {
                garden.plots[i].xp = 0;
                garden.plots[i].stage = 0;
            }
            st.otherTeamProgress[team] = 0;
        }
        saveState();
    }

    function randomlyGrowOtherTeams() {
        const st = getState();
        // Randomly add XP to other team gardens
        for (let team = 2; team <= 4; team++) {
            if (Math.random() < 0.3) { // 30% chance per team
                const garden = st.gardens[team];
                const plotIndex = randomInt(0, 15);
                const xpGain = randomInt(10, 30);
                garden.plots[plotIndex].xp = Math.min(MAX_PLOT_XP, garden.plots[plotIndex].xp + xpGain);
                garden.plots[plotIndex].stage = getStageFromXP(garden.plots[plotIndex].xp);
                st.otherTeamProgress[team] = (st.otherTeamProgress[team] || 0) + xpGain;
            }
        }
        saveState();
    }

    let teammateInterval = null;

    function startTeammateSimulation() {
        if (teammateInterval) return;
        teammateInterval = setInterval(function() {
            const st = getState();
            if (st.currentView === 'garden') {
                // Random chance for teammate to add seeds
                if (Math.random() < 0.15) { // 15% chance every 3 seconds
                    const seedAmount = randomInt(1, 5);
                    addSeeds(seedAmount);

                    // Show floating notification
                    const gardenCanvas = document.getElementById('garden-canvas');
                    if (gardenCanvas) {
                        const rect = gardenCanvas.getBoundingClientRect();
                        const x = rect.left + Math.random() * rect.width;
                        const y = rect.top + 20;
                        const teammates = ['Alex', 'Sam', 'Jordan', 'Taylor'];
                        const name = teammates[randomInt(0, 3)];
                        showFloatingText(name + ' +' + seedAmount + ' 🌱', x, y, '#4CAF50');
                        playCoinCollect();
                    }
                }

                // Also grow other team gardens
                randomlyGrowOtherTeams();
            }
        }, 3000);
    }

    function stopTeammateSimulation() {
        if (teammateInterval) {
            clearInterval(teammateInterval);
            teammateInterval = null;
        }
    }

    function flyRewardsToHUD(coins, seeds) {
        const gardenCanvas = document.getElementById('garden-canvas');
        const canvasRect = gardenCanvas.getBoundingClientRect();
        const startX = canvasRect.left + canvasRect.width / 2;
        const startY = canvasRect.top + canvasRect.height / 2;

        // Get target positions
        const coinTarget = document.getElementById('top-coins');
        const seedTarget = document.getElementById('top-seeds');
        const leaderboardTarget = document.getElementById('leaderboard-nav');

        // Fly coins
        for (let i = 0; i < Math.min(coins, 8); i++) {
            setTimeout(function() {
                createFlyingReward('🪙', startX + (Math.random() - 0.5) * 100,
                    startY + (Math.random() - 0.5) * 100, coinTarget, 'coin');
                playCoinCollect();
            }, i * 80);
        }

        // Fly seeds
        for (let i = 0; i < Math.min(seeds, 5); i++) {
            setTimeout(function() {
                createFlyingReward('🌱', startX + (Math.random() - 0.5) * 100,
                    startY + (Math.random() - 0.5) * 100, seedTarget, 'seed');
            }, 400 + i * 100);
        }

        // Fly hay to leaderboard
        setTimeout(function() {
            createFlyingReward('🌾', startX, startY, leaderboardTarget, 'hay');
            playHarvestChime();
        }, 800);
    }

    function createFlyingReward(emoji, startX, startY, targetEl, type) {
        const reward = document.createElement('div');
        reward.className = 'flying-reward ' + type;
        reward.textContent = emoji;
        reward.style.left = startX + 'px';
        reward.style.top = startY + 'px';
        document.body.appendChild(reward);

        // Get target position
        const targetRect = targetEl.getBoundingClientRect();
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        // Animate to target
        requestAnimationFrame(function() {
            reward.style.left = targetX + 'px';
            reward.style.top = targetY + 'px';
            reward.style.opacity = '0';
            reward.style.transform = 'scale(0.3)';
        });

        // Remove after animation
        setTimeout(function() {
            reward.remove();
        }, 700);
    }

    function triggerHarvestFromBoard() {
        playClick();
        playSwoosh();
        setState({ currentView: 'garden' });
        showGardenView();
        // Small delay then auto-start harvest
        setTimeout(startHarvest, 300);
    }

    function debugTriggerHarvest() {
        playClick();

        // Set harvest state (harvest whatever is currently in garden)
        setNeedsHarvest(true);

        // Navigate to garden
        playSwoosh();
        setState({ currentView: 'garden' });
        showGardenView();
    }

    // ==================== GO BUTTON ====================
    function handleGoButton() {
        playClick();

        // Give seeds
        const seedsToAdd = randomInt(1, 3);
        addSeeds(seedsToAdd);

        // Show +N text over GO button
        showGoRewardText('+' + seedsToAdd);

        // Fly seed icons to the seed counter
        flySedsFromGoButton(seedsToAdd);
    }

    function showFloatingText(text, x, y, color) {
        color = color || '#FFD700';
        const notification = document.createElement('div');
        notification.className = 'floating-text';
        notification.style.color = color;
        notification.style.left = x + 'px';
        notification.style.top = y + 'px';
        notification.textContent = text;
        document.body.appendChild(notification);

        requestAnimationFrame(function() {
            notification.style.top = (y - 50) + 'px';
            notification.style.opacity = '0';
        });

        setTimeout(function() { notification.remove(); }, 800);
    }

    function handleWinsClick(e) {
        playClick();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top;
        showFloatingText('😉', x, y, '#FFD700');
    }

    function showGoRewardText(text) {
        const goButton = document.getElementById('go-button');
        const rect = goButton.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const notification = document.createElement('div');
        notification.style.cssText = 'position:fixed;color:#4CAF50;font-size:32px;font-weight:bold;z-index:100;pointer-events:none;text-shadow:2px 2px 4px rgba(0,0,0,0.7), 0 0 10px rgba(76,175,80,0.5);transition:all 0.6s ease-out;transform:translate(-50%,-50%) scale(0.5);opacity:0;';
        notification.style.left = centerX + 'px';
        notification.style.top = centerY + 'px';
        notification.textContent = text;
        document.body.appendChild(notification);

        // Pop in
        requestAnimationFrame(function() {
            notification.style.transform = 'translate(-50%,-50%) scale(1.2)';
            notification.style.opacity = '1';

            setTimeout(function() {
                notification.style.transform = 'translate(-50%,-150%) scale(0.8)';
                notification.style.opacity = '0';
            }, 400);
        });

        setTimeout(function() { notification.remove(); }, 1000);
    }

    function flySedsFromGoButton(count) {
        const goButton = document.getElementById('go-button');
        const seedTarget = document.getElementById('top-seeds');
        const goRect = goButton.getBoundingClientRect();
        const targetRect = seedTarget.getBoundingClientRect();

        const startX = goRect.left + goRect.width / 2;
        const startY = goRect.top + goRect.height / 2;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;

        for (let i = 0; i < count; i++) {
            setTimeout(function() {
                const seed = document.createElement('div');
                seed.className = 'flying-reward seed';
                seed.textContent = '🌱';
                seed.style.left = (startX + (Math.random() - 0.5) * 40) + 'px';
                seed.style.top = (startY + (Math.random() - 0.5) * 40) + 'px';
                document.body.appendChild(seed);

                playCoinCollect();

                requestAnimationFrame(function() {
                    seed.style.left = endX + 'px';
                    seed.style.top = endY + 'px';
                    seed.style.opacity = '0';
                    seed.style.transform = 'scale(0.3)';
                });

                setTimeout(function() { seed.remove(); }, 700);
            }, i * 100);
        }
    }

    // ==================== NAVIGATION ====================
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
        resizeBoardCanvas();
        renderBoard();
    }

    function showGardenView() {
        document.getElementById('board-view').classList.remove('active');
        document.getElementById('garden-view').classList.add('active');
        resizeGardenCanvas();
        renderGarden();
    }

    // ==================== INIT ====================
    function init() {
        initState();

        // Enable audio on first interaction
        document.addEventListener('click', function() { initAudio(); }, { once: true });
        document.addEventListener('touchstart', function() { initAudio(); }, { once: true });

        // Init components
        initBoard(document.getElementById('board-canvas'));
        initGarden(document.getElementById('garden-canvas'));
        initDice(
            document.getElementById('die1'),
            document.getElementById('die2'),
            document.getElementById('roll-btn'),
            document.getElementById('roll-result')
        );

        // Navigation handlers
        document.getElementById('go-button').addEventListener('click', handleGoButton);
        document.getElementById('garden-badge').addEventListener('click', navigateToGarden);
        document.getElementById('back-btn').addEventListener('click', navigateToBoard);

        // Harvest handlers
        document.getElementById('harvest-trigger-btn').addEventListener('click', triggerHarvestFromBoard);
        document.getElementById('harvest-btn').addEventListener('click', startHarvest);

        // Debug handler
        document.getElementById('debug-harvest-btn').addEventListener('click', debugTriggerHarvest);

        // Multiplier button
        document.getElementById('multiplier-btn').addEventListener('click', handleMultiplierClick);

        // Wins button
        document.getElementById('leaderboard-nav').addEventListener('click', handleWinsClick);

        // Start teammate simulation
        startTeammateSimulation();

        // State updates
        subscribeState(function(st) {
            updateAllUI(st);
            if (st.currentView === 'board') {
                renderBoard();
            } else {
                renderGarden();
            }
        });

        // Timer interval
        setInterval(updateTimer, 1000);

        // Initial UI update
        updateAllUI(getState());

        // Show correct view
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
