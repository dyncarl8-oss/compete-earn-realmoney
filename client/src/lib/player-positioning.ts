export type TablePosition = 'bottom' | 'left' | 'top' | 'right' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export interface PlayerPositionConfig {
  playerId: string;
  position: TablePosition;
  isCurrentPlayer: boolean;
}

/**
 * Calculates optimal player positions around a table for 2-5 players
 * Always positions the current player at the bottom from their POV
 */
export function calculatePlayerPositions(
  playerIds: string[],
  currentPlayerId: string
): PlayerPositionConfig[] {
  const playerCount = playerIds.length;
  
  if (playerCount < 2 || playerCount > 5) {
    throw new Error('Player count must be between 2 and 5');
  }

  // Find current player index
  const currentPlayerIndex = playerIds.findIndex(id => id === currentPlayerId);
  if (currentPlayerIndex === -1) {
    throw new Error('Current player not found in player list');
  }

  // Define position layouts for different player counts
  const positionLayouts: Record<number, TablePosition[]> = {
    2: ['bottom', 'top'],
    3: ['bottom', 'top-left', 'top-right'],
    4: ['bottom', 'left', 'top', 'right'],
    5: ['bottom', 'left', 'top-left', 'top-right', 'right']
  };

  const layout = positionLayouts[playerCount];
  
  // Rotate the player array so current player is first (will be at bottom)
  const rotatedPlayers = [
    ...playerIds.slice(currentPlayerIndex),
    ...playerIds.slice(0, currentPlayerIndex)
  ];

  // Map players to positions
  return rotatedPlayers.map((playerId, index) => ({
    playerId,
    position: layout[index],
    isCurrentPlayer: playerId === currentPlayerId
  }));
}

/**
 * Gets the animation transform for dice moving toward a player's position
 */
export function getDiceAnimationDirection(position: TablePosition): string {
  const directions: Record<TablePosition, string> = {
    'bottom': 'translate-y-8',
    'top': '-translate-y-8', 
    'left': '-translate-x-8',
    'right': 'translate-x-8',
    'bottom-left': 'translate-x-6 translate-y-6',
    'bottom-right': '-translate-x-6 translate-y-6',
    'top-left': 'translate-x-6 -translate-y-6',
    'top-right': '-translate-x-6 -translate-y-6'
  };
  
  return directions[position] || '';
}

/**
 * Gets the optimal dice count and spacing for table display
 */
export function getDiceDisplayConfig(diceCount: number = 5) {
  return {
    spacing: diceCount <= 3 ? 'space-x-6' : 'space-x-4',
    scale: diceCount <= 3 ? 'scale-110' : 'scale-100',
    maxWidth: diceCount * 80 + (diceCount - 1) * 16 // Rough calculation for spacing
  };
}

/**
 * Gets pixel offset from center for dice positioning near player anchor points
 */
export function getPlayerAnchorOffset(position: TablePosition): { x: number; y: number } {
  // Offsets are relative to center of the table (in pixels)
  // These values position dice closer to player positions while keeping them on the table
  const offsets: Record<TablePosition, { x: number; y: number }> = {
    'bottom': { x: 0, y: 120 },
    'top': { x: 0, y: -120 },
    'left': { x: -160, y: 0 },
    'right': { x: 160, y: 0 },
    'bottom-left': { x: -120, y: 90 },
    'bottom-right': { x: 120, y: 90 },
    'top-left': { x: -120, y: -90 },
    'top-right': { x: 120, y: -90 }
  };
  
  return offsets[position];
}

/**
 * Simple seeded pseudo-random number generator
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
    return state / Math.pow(2, 32);
  };
}

/**
 * Computes random scatter positions for dice after rolling - like throwing dice naturally
 */
export function computeScatterPositions(
  diceCount: number, 
  seed: number, 
  area: { width: number; height: number } = { width: 400, height: 240 }
): Array<{ x: number; y: number; rotation: number }> {
  const rng = seededRandom(seed);
  const positions: Array<{ x: number; y: number; rotation: number }> = [];
  const minDistance = 40; // Reduced minimum distance for more natural clustering
  
  for (let i = 0; i < diceCount; i++) {
    let attempts = 0;
    let position: { x: number; y: number; rotation: number };
    
    do {
      // Create more natural scatter patterns with some bias toward center
      const spreadX = (rng() - 0.5) * area.width * (0.7 + rng() * 0.6); // Variable spread
      const spreadY = (rng() - 0.5) * area.height * (0.7 + rng() * 0.6);
      
      position = {
        x: spreadX,
        y: spreadY,
        rotation: rng() * 360 // Full rotation range
      };
      attempts++;
    } while (
      attempts < 30 && // Reduced attempts for more natural clustering
      positions.some(p => 
        Math.sqrt(Math.pow(p.x - position.x, 2) + Math.pow(p.y - position.y, 2)) < minDistance
      )
    );
    
    positions.push(position);
  }
  
  return positions;
}

/**
 * Gets the base position for dice container aligned with roll button positions (for parked phase)
 * Coordinates are relative to table center, with positive X = right, positive Y = down
 */
export function getPlayerDiceBasePosition(currentPlayerPosition: TablePosition): { x: number; y: number } {
  // Position dice towards table center from roll button position
  // Coordinate system: positive X = right, positive Y = down from table center
  let baseX = 0;
  let baseY = 0;
  
  switch (currentPlayerPosition) {
    case 'bottom':
      // Roll button at bottom edge - dice towards center (up from button)
      baseX = 0;      // Horizontally centered
      baseY = 80;     // Towards center from bottom edge
      break;
    case 'top':
      // Roll button at top edge - dice towards center (down from button)
      baseX = 0;      // Horizontally centered  
      baseY = -180;    // Towards center from top edge
      break;
    case 'left':
      // Roll button at left edge - dice towards center (right from button)
      baseX = -260;   // Towards center from left edge (negative = left side of center)
      baseY = 0;      // Vertically centered
      break;
    case 'right':
      // Roll button at right edge - dice towards center (left from button)
      baseX = 200;    // Towards center from right edge (positive = right side of center)
      baseY = 0;      // Vertically centered
      break;
    case 'top-left':
      // Roll button at top-left corner - dice towards center
      baseX = -160;   // Towards center from left
      baseY = -220;    // Towards center from top
      break;
    case 'top-right':
      // Roll button at top-right corner - dice towards center
      baseX = 120;    // Towards center from right
      baseY = -220;    // Towards center from top
      break;
    case 'bottom-left':
      // Roll button at bottom-left corner - dice towards center
      baseX = -100;   // Towards center from left
      baseY = 60;     // Towards center from bottom
      break;
    case 'bottom-right':
      // Roll button at bottom-right corner - dice towards center
      baseX = 100;    // Towards center from right
      baseY = 60;     // Towards center from bottom
      break;
  }
  
  return { x: baseX, y: baseY };
}

/**
 * Computes positions for parked dice - positioned naturally for each player position
 */
export function computeParkedDicePositions(
  diceCount: number,
  currentPlayerPosition: TablePosition
): Array<{ x: number; y: number; rotation: number }> {
  const positions: Array<{ x: number; y: number; rotation: number }> = [];
  const spacing = 55; // Space between dice
  
  const basePosition = getPlayerDiceBasePosition(currentPlayerPosition);
  
  // Use different layouts based on position for better visual appearance from all POVs
  const isHorizontalPosition = ['bottom', 'top', 'bottom-left', 'bottom-right', 'top-left', 'top-right'].includes(currentPlayerPosition);
  
  if (isHorizontalPosition) {
    // Horizontal alignment for bottom/top/corner positions
    const centerOffset = -((diceCount - 1) * spacing) / 2;
    
    for (let i = 0; i < diceCount; i++) {
      positions.push({
        x: basePosition.x + centerOffset + (i * spacing),
        y: basePosition.y, // All dice at same Y level
        rotation: Math.random() * 20 - 10
      });
    }
  } else {
    // Vertical alignment for side positions (left/right) - looks more natural from enemy POV
    const centerOffset = -((diceCount - 1) * spacing) / 2;
    
    for (let i = 0; i < diceCount; i++) {
      positions.push({
        x: basePosition.x, // All dice at same X level
        y: basePosition.y + centerOffset + (i * spacing),
        rotation: Math.random() * 20 - 10
      });
    }
  }
  
  return positions;
}

/**
 * Computes positions for held dice in fixed corner areas based on player position
 */
export function computeHeldDicePositions(
  heldDiceCount: number,
  currentPlayerPosition: TablePosition
): Array<{ x: number; y: number; rotation: number }> {
  const positions: Array<{ x: number; y: number; rotation: number }> = [];
  const spacing = 55; // Space between held dice
  
  // Fixed positions for each corner/side (relative to a 500x300 container)
  let baseX = 0;
  let baseY = 0;
  let directionX = 1; // 1 for right, -1 for left
  let directionY = 0; // 0 for horizontal line, 1 for vertical down
  
  switch (currentPlayerPosition) {
    case 'bottom':
      // Bottom center - dice to the right
      baseX = 50;
      baseY = 150;
      directionX = 1;
      directionY = 0;
      break;
    case 'top':
      // Top center - dice to the left to avoid going off screen
      baseX = -50;
      baseY = -180;
      directionX = -1;
      directionY = 0;
      break;
    case 'left':
      // Left side - dice below
      baseX = -270;
      baseY = -30;
      directionX = 0;
      directionY = 1;
      break;
    case 'right':
      // Right side - dice below
      baseX = 220;
      baseY = -30;
      directionX = 0;
      directionY = 1;
      break;
    case 'top-left':
      // Top-left corner - dice to the right horizontally
      baseX = -250;
      baseY = -220;
      directionX = 1;
      directionY = 0;
      break;
    case 'top-right':
      // Top-right corner - dice to the left horizontally
      baseX = 220;
      baseY = -220;
      directionX = -1;
      directionY = 0;
      break;
    case 'bottom-left':
      // Bottom-left corner - dice to the right horizontally
      baseX = -180;
      baseY = 110;
      directionX = 1;
      directionY = 0;
      break;
    case 'bottom-right':
      // Bottom-right corner - dice to the left horizontally
      baseX = 180;
      baseY = 110;
      directionX = -1;
      directionY = 0;
      break;
  }
  
  for (let i = 0; i < heldDiceCount; i++) {
    positions.push({
      x: baseX + (directionX * i * spacing),
      y: baseY + (directionY * i * spacing),
      rotation: Math.random() * 20 - 10 // Small rotation variation for natural look
    });
  }
  
  return positions;
}

/**
 * Dice positioning phases
 */
export type DicePhase = 'parked' | 'to-center' | 'scattered';

/**
 * Generates a seed for scatter positions based on game state
 */
export function generateScatterSeed(gameId: string, userId: string, rollCount: number): number {
  // Create a simple hash from the input strings and numbers
  const str = `${gameId}-${userId}-${rollCount}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}