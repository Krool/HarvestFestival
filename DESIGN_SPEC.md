# Harvest Festival - Game Design Specification

## Overview
A Monopoly Go-inspired prototype featuring a central board view with four team quadrants, each containing a 4x4 garden that players cultivate through dice-based mechanics.

---

## Core Screens

### 1. Main Board View
**Description:** The primary view showing the full Monopoly-style board with four team quadrants in the center.

**Visual Elements:**
- Monopoly board perimeter (properties around the edge)
- Center diamond divided into 4 quadrants:
  - T1 (Top) - Cyan/Blue
  - T2 (Right) - Coral/Red
  - T3 (Bottom) - Purple/Lavender
  - T4 (Left) - Lime/Green
- Each quadrant displays a miniature preview of that team's garden
- Haystack icon visible in each quadrant

**HUD Elements:**
- Floating badge in corner (bottom-right)
- 12-hour countdown timer below badge
- Badge shows current seed count

**Interactions:**
- Click HUD badge → Navigate to Garden View
- Click center of board → Navigate to Garden View
- Drag to pan around the board (bounded)

---

### 2. Garden View
**Description:** Detailed view for managing your 4x4 garden plot.

**Visual Elements:**
- 4x4 grid of garden plots (16 total)
- Each plot displays:
  - Current plant/seed state (empty, planted, growing stages)
  - XP progress bar below plot
- Haystack display showing seed inventory
- Dice rolling area

**Dice Mechanics:**

| Die 1 (Position) | Die 2 (Value) |
|------------------|---------------|
| 1, 2, 3, 4       | 1, 2, 3, 4, 2x |

**Roll Outcomes:**
| Die 1 | Die 2 | Result |
|-------|-------|--------|
| 1-4   | 1-4   | Plant seed at coordinate (Die1, Die2) |
| 1-4   | 2x    | Plant seeds in entire row Die1 |
| 2x    | 1-4   | Plant seeds in entire column Die2 |
| 2x    | 2x    | Add XP to ALL plots on board |

**XP System:**
- Each plot has individual XP (0-100)
- Rolling a plot coordinate adds XP to that plot
- Filling XP bar evolves the plant to next growth stage

**Interactions:**
- Roll Dice button (consumes 1 seed per roll)
- Back button → Return to Board View

---

## Game State

### Resources
- **Seeds:** Currency for dice rolls, stored in haystack
- **XP:** Per-plot experience points

### Timer
- 12-hour countdown timer
- Resets and grants bonus seeds when expired
- Persists across sessions (localStorage)

---

## Audio Design

### Programmatic Sound Effects
All sounds generated via Web Audio API (no external files)

| Event | Sound Type |
|-------|------------|
| Dice Roll | Rattling/shaking noise |
| Dice Land | Satisfying thud |
| Plot Hit (single) | Chime/ding |
| Row/Column Hit | Rising arpeggio |
| Full Board XP | Triumphant fanfare |
| Timer Complete | Bell notification |
| Button Click | Soft click |
| Navigate | Swoosh |

---

## Technical Requirements

- HTML5 Canvas or DOM-based rendering
- Web Audio API for sound synthesis
- localStorage for game state persistence
- Touch/mouse drag for panning
- Responsive design for various screen sizes

---

## Color Palette

| Element | Color |
|---------|-------|
| T1 Quadrant | #00CED1 (Cyan) |
| T2 Quadrant | #FF6B6B (Coral) |
| T3 Quadrant | #DDA0DD (Plum) |
| T4 Quadrant | #90EE90 (Light Green) |
| Board Background | #F5DEB3 (Wheat) |
| Plot Empty | #8B4513 (Saddle Brown) |
| Plot Planted | #228B22 (Forest Green) |
| XP Bar Empty | #333333 |
| XP Bar Filled | #FFD700 (Gold) |
