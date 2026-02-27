// ============================================================
//  POCKET ROGUELITE — ARCADE PHYSICS CONSTANTS
// ============================================================

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

// Table geometry (inside the cushions)
export const TABLE = {
  X: 80,
  Y: 60,
  W: 800,
  H: 420,
  CUSHION: 20,
};

// 6 pockets: 4 corners + 2 side-centre
export const POCKETS = [
  { x: TABLE.X,              y: TABLE.Y },
  { x: TABLE.X + TABLE.W / 2, y: TABLE.Y },
  { x: TABLE.X + TABLE.W,    y: TABLE.Y },
  { x: TABLE.X,              y: TABLE.Y + TABLE.H },
  { x: TABLE.X + TABLE.W / 2, y: TABLE.Y + TABLE.H },
  { x: TABLE.X + TABLE.W,    y: TABLE.Y + TABLE.H },
];
export const POCKET_RADIUS = 22;

// ---- Arcade Physics Tuning (PUNCHY — high energy, exaggerated) ----
export const BALL_DEFAULT_RADIUS = 12;

// Shot / force
export const MAX_SHOT_FORCE   = 0.04;    // punchy arcade impulse
export const DRAG_DIVISOR     = 180;     // reach max power with shorter drag
export const MAX_AIM_LINE_LEN = 280;     // longer aim preview

// Speed governance
export const MAX_SPEED             = 24;    // high cap for dramatic motion
export const MANUAL_DAMPING        = 0.996; // lighter damping — balls travel further after hits
export const MIN_REST_SPEED        = 0.04;  // below this for REST_FRAMES → snap to zero
export const REST_FRAMES_REQUIRED  = 30;    // ~0.5 s at 60 fps

// Default ball physics (overridden per-ball via JSON)
export const DEFAULT_RESTITUTION  = 0.98;  // very bouncy — chaotic arcade collisions
export const DEFAULT_FRICTION     = 0.001;
export const DEFAULT_FRICTION_AIR = 0.010; // low air drag — balls glide and scatter
export const DEFAULT_MASS         = 1.0;

// Wall physics
export const WALL_RESTITUTION = 0.96;     // crisp wall bounces
export const WALL_FRICTION    = 0.005;

// Impact amplifier (multiplied on raw dv magnitude in PhysicsSystem)
export const IMPACT_AMPLIFIER      = 1.6;  // exaggerated impact for VFX triggers

// VFX thresholds (LOWER = more effects trigger = more cartoon punch)
export const VFX_SPARK_THRESHOLD   = 0.3;  // sparks on almost any visible hit
export const VFX_SHAKE_THRESHOLD   = 1.2;  // shake on medium hits
export const VFX_CHAIN_THRESHOLD   = 2.0;  // chain push earlier
export const VFX_SLOWMO_THRESHOLD  = 3.5;  // hit-stop on big impacts
export const VFX_WALL_SPARK_THRESH = 0.8;  // wall sparks more easily
export const CHAIN_PUSH_RADIUS     = 140;  // wide chain reaction radius
export const CHAIN_PUSH_FORCE      = 0.012; // stronger push on nearby balls

// Solver (set on Matter.Engine after Phaser creates it)
export const POSITION_ITERATIONS   = 10;
export const VELOCITY_ITERATIONS   = 8;
export const CONSTRAINT_ITERATIONS = 4;

// Phases
export const PHASE = { BUILD: 'build', PLAY: 'play', RESULT: 'result' };

// Collision categories (bitmask)
export const CATEGORY = {
  BALL:     0x0001,
  WALL:     0x0002,
  POCKET:   0x0004,
  BUILDING: 0x0008,
  SENSOR:   0x0010,
};
