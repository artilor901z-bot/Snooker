# Pocket Roguelite

A browser-based arcade billiards game with roguelite mechanics — build your table, aim your shots, and pocket balls to score.

## Quick Start

```bash
npm install
npm run dev     # → localhost:8080
npm run build   # → dist/
```

## Gameplay

**Three-phase loop per level:**

1. **BUILD** — Spend coins in the shop to buy extra balls and place buildings on the table
2. **PLAY** — Aim the cue ball (click-drag), release to shoot. Pocket balls to score points
3. **RESULT** — Hit the target score to advance. Fail and restart the level

**Controls:**
- Click & drag near cue ball to aim (pull-back mechanic)
- Release to shoot — power scales with drag distance
- Right-click during building placement to cancel
- Press `` ` `` (backtick) for debug physics view

## Features

- **10 Ball Types** — Basic, Explosive, Splitter, Heavy, Ghost, Multiplier, Speed, Sticky, Teleport, Chain Reactor
- **10 Building Types** — Portal, Bumper, Splitter Trap, Absorber, Accelerator, Multiplier Zone, Rotator, Black Hole, Duplicator, Chaos Tile
- **3 Levels** — Progressive difficulty with unique layouts and pre-placed buildings
- **Arcade Physics** — High restitution, low friction, satisfying ball movement with speed cap and rest-snap
- **Juicy VFX** — Screen shake, squash/stretch, particle bursts, lightning bolts, slow-mo on explosions, floating score text
- **Procedural Audio** — All SFX generated at runtime via Web Audio (no audio files needed)
- **Procedural Visuals** — All graphics rendered via code (no image assets required)

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Phaser 3 | 3.90 | Game framework + Matter.js physics |
| Howler.js | 2.2 | Audio management with pitch randomization |
| Vite | 6.x | Bundler / dev server |

## Project Structure

```
src/
├── main.js                    Phaser config (960×540, Matter.js, zero gravity)
├── constants.js               Table geometry, physics tuning, collision categories
├── scenes/
│   ├── BootScene.js           Procedural texture generation + audio init
│   ├── MenuScene.js           Title screen + play button
│   └── PlayScene.js           Main game orchestrator (Build→Play→Result)
├── systems/
│   ├── PhysicsSystem.js       Collision routing, speed cap, damping, rest-snap
│   ├── ScoreSystem.js         Scoring, combos, coins, level completion
│   └── AudioSystem.js         Howler.js singleton with procedural WAV synthesis
├── entities/
│   ├── Ball.js                Physics body + visuals + ability dispatch
│   ├── BallFactory.js         Creates balls from balls.json data
│   ├── Building.js            Static body + visuals + behavior dispatch
│   ├── BuildingFactory.js     Creates buildings with portal pairing
│   ├── Table.js               Walls + felt + diamond markers
│   └── Pocket.js              Sensor circles at 6 positions
├── abilities/
│   ├── BallAbilities.js       10 ball special abilities (explode, split, chain, etc.)
│   └── BuildingBehaviors.js   10 building behaviors (teleport, bounce, attract, etc.)
├── ui/
│   ├── AimingUI.js            Dotted aim line + power bar
│   ├── ScoreUI.js             HUD: score, target, shots, coins, phase
│   ├── ShopUI.js              HTML overlay shop for build phase
│   └── DebugUI.js             Backtick toggle for physics debug view
├── effects/
│   └── JuiceEffects.js        Particles, shake, squash/stretch, lightning, slow-mo
└── data/
    ├── balls.json             10 ball type definitions
    ├── buildings.json         10 building type definitions
    ├── level1.json            "First Break" — 6 balls, gentle intro
    ├── level2.json            "Ricochet Rally" — 10 balls, pre-placed buildings
    └── level3.json            "Chaos Chamber" — 15 balls, 4 pre-placed buildings
```

## Architecture

### Data-Driven Entities
Ball abilities and building behaviors are keyed by string lookup:
- Balls: `data.special.action` → `ballAbilities[action].onBallCollision()`
- Buildings: `data.action` → `buildingBehaviors[action].onCollision()`

### Event-Driven Collisions
`PhysicsSystem` routes Matter.js collisions by `body.label` prefix:
- `ball_*` + `pocket` → `ball-pocketed`
- `ball_*` + `ball_*` → `ball-ball-collision`
- `ball_*` + `wall` → `ball-wall-collision`
- `ball_*` + `building_*` → `ball-building-collision`

### Physics Tuning
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MAX_SPEED` | 18 | Hard velocity cap per frame |
| `MANUAL_DAMPING` | 0.993 | Multiplicative slowdown per step |
| `MIN_REST_SPEED` | 0.04 | Below this for 30 frames → snap to zero |
| `WALL_RESTITUTION` | 0.75 | Wall bounciness |
| `Ball restitution` | 0.85–0.96 | Per-ball-type bounciness |
| Solver iterations | 10/8/4 | Position/velocity/constraint |
| Ball inertia | Infinity | No angular velocity (top-down game) |

## QA Checklist

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | `npm run dev` → open browser | Menu screen shows with PLAY button |
| 2 | Click PLAY | Level 1 banner appears, then BUILD phase with shop |
| 3 | Purchase a ball from shop | Coins decrease, new ball appears on table |
| 4 | Purchase a building, place on table | Ghost follows mouse, click to place, returns to shop |
| 5 | Right-click during placement | Cancelled, coins refunded, returns to shop |
| 6 | Click START in shop | PLAY phase begins, aim UI enabled |
| 7 | Click-drag near cue ball, release | Dotted aim line + power bar shown, ball shoots on release |
| 8 | Pocket a target ball | Score increases, floating "+XX" text, pocket burst particles |
| 9 | Pocket the cue ball | Cue ball respawns at start position, screen shake |
| 10 | All balls stop after shot | Aiming re-enabled if shots remain |
| 11 | Score >= target score | "LEVEL COMPLETE!" banner, advance to next level |
| 12 | Out of shots, score < target | "OUT OF SHOTS!" banner, level restarts |
| 13 | Complete all 3 levels | Returns to menu with victory message |
| 14 | Explosive ball hits another | AoE push, explosion particles, slow-mo snap |
| 15 | Ball enters black hole radius | Attracted inward, pocketed at kill radius |
| 16 | Portal pair activated | Ball teleports to linked portal, purple flash |
| 17 | Bumper collision | Ball bounces away with impulse, bumper squash animation |
| 18 | Press backtick key | Debug physics wireframes toggle on/off |
| 19 | Refresh page during gameplay | No console errors, clean restart |
| 20 | `npm run build` | Build succeeds, dist/ folder created |

## License

Private / All rights reserved.
