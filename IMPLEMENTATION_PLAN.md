# Harvest Festival - Implementation Plan

## Tech Stack
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 Canvas** - For board and garden rendering
- **Web Audio API** - Programmatic sound synthesis
- **CSS3** - Styling and animations
- **localStorage** - State persistence

---

## File Structure
```
HarvestFestival/
├── index.html          # Entry point
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── main.js         # Entry point, game loop
│   ├── state.js        # Game state management
│   ├── audio.js        # Sound synthesis
│   ├── board.js        # Main board view rendering
│   ├── garden.js       # Garden view rendering
│   ├── dice.js         # Dice mechanics
│   ├── hud.js          # HUD components
│   └── utils.js        # Helpers
└── assets/             # Any static assets
```

---

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure
1. Create HTML skeleton with canvas elements
2. Set up CSS base styles
3. Implement game state manager (state.js)
4. Create utility functions

### Phase 2: Audio System
1. Initialize Web Audio API context
2. Create oscillator-based sound generators:
   - `playClick()` - UI feedback
   - `playDiceRoll()` - Dice shaking
   - `playDiceLand()` - Dice landing
   - `playPlotHit()` - Single plot chime
   - `playRowHit()` - Row/column arpeggio
   - `playFullBoardFanfare()` - Triumphant sound
   - `playTimerComplete()` - Bell sound

### Phase 3: Main Board View
1. Render Monopoly board perimeter (simplified)
2. Draw center diamond with 4 quadrants
3. Add team colors and labels
4. Implement miniature garden previews
5. Add pan/drag functionality with bounds

### Phase 4: HUD System
1. Create floating badge component
2. Implement 12-hour countdown timer
3. Display seed count
4. Add click handlers for navigation

### Phase 5: Garden View
1. Render 4x4 grid
2. Draw plot states (empty, planted, growth stages)
3. Add XP bars below each plot
4. Display haystack/seed inventory
5. Add back button

### Phase 6: Dice System
1. Create dice visual components
2. Implement roll animation
3. Handle roll outcomes:
   - Single coordinate
   - Full row (1s on position die)
   - Full column (1s on value die)
   - Full board (double 2x)
4. Apply XP to affected plots
5. Deduct seeds from haystack

### Phase 7: Polish & Integration
1. Connect all navigation flows
2. Add state persistence (localStorage)
3. Timer bonus seed grants
4. Test all interactions
5. Add visual feedback animations

---

## State Schema

```javascript
const gameState = {
  seeds: 50,                    // Starting seeds
  timerEnd: timestamp,          // 12hr timer endpoint
  currentView: 'board',         // 'board' | 'garden'
  selectedTeam: 1,              // Current player's team (1-4)
  gardens: {
    1: { plots: Array(16).fill({ xp: 0, stage: 0 }) },
    2: { plots: Array(16).fill({ xp: 0, stage: 0 }) },
    3: { plots: Array(16).fill({ xp: 0, stage: 0 }) },
    4: { plots: Array(16).fill({ xp: 0, stage: 0 }) }
  },
  boardOffset: { x: 0, y: 0 }   // Pan position
};
```

---

## Execution Order

1. [ ] index.html - Basic structure
2. [ ] styles.css - Core styles
3. [ ] utils.js - Helper functions
4. [ ] state.js - State management
5. [ ] audio.js - Sound system
6. [ ] hud.js - HUD components
7. [ ] board.js - Main board
8. [ ] garden.js - Garden view
9. [ ] dice.js - Dice mechanics
10. [ ] main.js - Wire everything together

---

## Key Functions

### state.js
- `initState()` - Initialize or load state
- `saveState()` - Persist to localStorage
- `getState()` / `setState()` - Access/modify

### audio.js
- `initAudio()` - Create AudioContext
- `playSound(type)` - Unified sound player

### board.js
- `renderBoard(ctx, state)` - Draw full board
- `handleBoardClick(x, y)` - Click detection
- `handleBoardDrag(dx, dy)` - Pan handling

### garden.js
- `renderGarden(ctx, state)` - Draw garden grid
- `updatePlot(team, index, xp)` - Modify plot
- `getPlotStage(xp)` - Calculate growth stage

### dice.js
- `rollDice()` - Generate roll result
- `applyRoll(result, state)` - Apply to garden
- `animateDice(result)` - Visual animation
