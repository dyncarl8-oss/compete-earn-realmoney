import { YahtzeeCategory, YAHTZEE_FIXED_SCORES } from "../shared/schema";

export interface AIDecision {
  type: 'hold' | 'score';
  holdPattern?: boolean[]; // Which dice to hold [true, false, true, false, false]
  category?: YahtzeeCategory; // Which category to score
}

/**
 * Calculate the score for a given category with current dice
 */
export function calculateScoreForDice(dice: number[], category: YahtzeeCategory): number {
  const counts = dice.reduce((acc, die) => {
    acc[die] = (acc[die] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const sortedCounts = Object.values(counts).sort((a, b) => b - a);
  const sum = dice.reduce((a, b) => a + b, 0);

  switch (category) {
    // Upper Section Categories - count specific numbers
    case 'ones': return (counts[1] || 0) * 1;
    case 'twos': return (counts[2] || 0) * 2;
    case 'threes': return (counts[3] || 0) * 3;
    case 'fours': return (counts[4] || 0) * 4;
    case 'fives': return (counts[5] || 0) * 5;
    case 'sixes': return (counts[6] || 0) * 6;
    
    // Lower Section Categories
    case 'threeOfAKind': return sortedCounts[0] >= 3 ? sum : 0;
    case 'fourOfAKind': return sortedCounts[0] >= 4 ? sum : 0;
    case 'fullHouse': return sortedCounts[0] === 3 && sortedCounts[1] === 2 ? YAHTZEE_FIXED_SCORES.fullHouse : 0;
    case 'smallStraight': {
      const uniqueDice = Array.from(new Set(dice)).sort();
      const straights = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
      return straights.some(straight => straight.every(num => uniqueDice.includes(num))) ? YAHTZEE_FIXED_SCORES.smallStraight : 0;
    }
    case 'largeStraight': {
      const uniqueDice = Array.from(new Set(dice)).sort();
      return (uniqueDice.join('') === '12345' || uniqueDice.join('') === '23456') ? YAHTZEE_FIXED_SCORES.largeStraight : 0;
    }
    case 'yahtzee': return sortedCounts[0] === 5 ? YAHTZEE_FIXED_SCORES.yahtzee : 0;
    case 'chance': return sum;
    default: return 0;
  }
}

/**
 * Get all available categories for scoring (those that haven't been used yet)
 */
export function getAvailableCategories(playerState: any): YahtzeeCategory[] {
  const allCategories: YahtzeeCategory[] = [
    'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
    'threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 
    'largeStraight', 'yahtzee', 'chance'
  ];
  
  return allCategories.filter(category => (playerState[category] ?? -1) === -1);
}

/**
 * Calculate the potential for getting a specific pattern
 */
export function calculatePotential(dice: number[], targetPattern: string): number {
  const counts = dice.reduce((acc, die) => {
    acc[die] = (acc[die] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const sortedCounts = Object.values(counts).sort((a, b) => b - a);
  
  switch (targetPattern) {
    case 'yahtzee': return sortedCounts[0] === 5 ? 1 : (sortedCounts[0] >= 3 ? 0.3 : 0);
    case 'fourOfAKind': return sortedCounts[0] >= 4 ? 1 : (sortedCounts[0] >= 3 ? 0.4 : 0);
    case 'threeOfAKind': return sortedCounts[0] >= 3 ? 1 : (sortedCounts[0] >= 2 ? 0.5 : 0);
    case 'fullHouse': return (sortedCounts[0] === 3 && sortedCounts[1] === 2) ? 1 : 
                              (sortedCounts[0] >= 3 ? 0.3 : 0);
    case 'largeStraight': {
      const uniqueDice = Array.from(new Set(dice)).sort();
      const hasLargeStraight = uniqueDice.join('') === '12345' || uniqueDice.join('') === '23456';
      if (hasLargeStraight) return 1;
      // Check for 4 in sequence
      const sequences = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
      const has4InSequence = sequences.some(seq => seq.filter(n => uniqueDice.includes(n)).length >= 4);
      return has4InSequence ? 0.4 : 0;
    }
    case 'smallStraight': {
      const uniqueDice = Array.from(new Set(dice)).sort();
      const straights = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
      const hasSmallStraight = straights.some(straight => straight.every(num => uniqueDice.includes(num)));
      if (hasSmallStraight) return 1;
      // Check for 3 in sequence
      const has3InSequence = straights.some(seq => seq.filter(n => uniqueDice.includes(n)).length >= 3);
      return has3InSequence ? 0.3 : 0;
    }
    default: return 0;
  }
}

/**
 * AI decision for which dice to hold (reroll the others)
 */
export function makeHoldDecision(dice: number[], rollCount: number, availableCategories: YahtzeeCategory[]): boolean[] {
  const counts = dice.reduce((acc, die) => {
    acc[die] = (acc[die] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const sortedCounts = Object.values(counts).sort((a, b) => b - a);
  
  // If this is the last roll, don't hold anything (we must score)
  if (rollCount >= 3) {
    return [false, false, false, false, false];
  }

  // Strategy 1: Hold dice that form patterns
  
  // Check for Yahtzee potential (5 of a kind)
  if (sortedCounts[0] >= 3) {
    const mostCommonValue = Object.keys(counts).find(key => counts[parseInt(key)] === sortedCounts[0]);
    if (mostCommonValue) {
      const value = parseInt(mostCommonValue);
      return dice.map(die => die === value);
    }
  }
  
  // Check for Four of a Kind potential
  if (sortedCounts[0] >= 3) {
    const mostCommonValue = Object.keys(counts).find(key => counts[parseInt(key)] === sortedCounts[0]);
    if (mostCommonValue) {
      const value = parseInt(mostCommonValue);
      return dice.map(die => die === value);
    }
  }
  
  // Check for Full House potential (3 of one + 2 of another)
  if (sortedCounts[0] === 3 && sortedCounts[1] === 2) {
    return [true, true, true, true, true]; // Hold all for full house
  }
  
  // Check for Large Straight potential
  const uniqueDice = Array.from(new Set(dice)).sort();
  const sequences = [[1,2,3,4,5], [2,3,4,5,6]];
  for (const seq of sequences) {
    if (seq.filter(n => uniqueDice.includes(n)).length >= 4) {
      return dice.map(die => seq.includes(die));
    }
  }
  
  // Check for Small Straight potential
  const smallSequences = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
  for (const seq of smallSequences) {
    if (seq.filter(n => uniqueDice.includes(n)).length >= 3) {
      return dice.map(die => seq.includes(die));
    }
  }
  
  // Strategy 2: Hold pairs or higher for Three of a Kind
  if (sortedCounts[0] >= 2) {
    const mostCommonValue = Object.keys(counts).find(key => counts[parseInt(key)] === sortedCounts[0]);
    if (mostCommonValue) {
      const value = parseInt(mostCommonValue);
      return dice.map(die => die === value);
    }
  }
  
  // Strategy 3: Hold high-value dice for upper section or chance
  // Hold 4s, 5s, and 6s if we don't have better patterns
  return dice.map(die => die >= 4);
}

/**
 * AI decision for which category to score
 */
export function makeScoreDecision(dice: number[], availableCategories: YahtzeeCategory[], playerState: any): YahtzeeCategory {
  // Calculate scores for all available categories
  const categoryScores = availableCategories.map(category => ({
    category,
    score: calculateScoreForDice(dice, category)
  }));
  
  // Sort by score descending
  categoryScores.sort((a, b) => b.score - a.score);
  
  // Strategy 1: If we have a high-scoring lower section combination, take it
  const highValueCategories = ['yahtzee', 'largeStraight', 'fullHouse', 'smallStraight'];
  for (const highValue of highValueCategories) {
    const found = categoryScores.find(cs => cs.category === highValue && cs.score > 0);
    if (found) return found.category;
  }
  
  // Strategy 2: Take the highest scoring available category
  if (categoryScores[0].score > 0) {
    return categoryScores[0].category;
  }
  
  // Strategy 3: If all scores are 0, take the least valuable category
  // Prefer taking upper section categories with low point values first
  const lowValueCategories: YahtzeeCategory[] = ['ones', 'twos', 'threes'];
  for (const lowValue of lowValueCategories) {
    if (availableCategories.includes(lowValue)) {
      return lowValue;
    }
  }
  
  // Fallback: take the first available category
  return availableCategories[0];
}

/**
 * Main AI decision function
 */
export function makeAIDecision(
  dice: number[], 
  rollCount: number, 
  availableCategories: YahtzeeCategory[], 
  playerState: any
): AIDecision {
  // If rollCount is 0, we haven't rolled yet, so always roll first
  if (rollCount === 0) {
    return {
      type: 'hold',
      holdPattern: [false, false, false, false, false] // Don't hold any dice on first roll
    };
  }
  
  // If we've rolled 3 times or no more rolls allowed, we must score
  if (rollCount >= 3) {
    return {
      type: 'score',
      category: makeScoreDecision(dice, availableCategories, playerState)
    };
  }
  
  // Check if we should score immediately (have a great result)
  const yahtzeeScore = calculateScoreForDice(dice, 'yahtzee');
  const largeStraightScore = calculateScoreForDice(dice, 'largeStraight');
  const fullHouseScore = calculateScoreForDice(dice, 'fullHouse');
  
  // Score immediately if we have Yahtzee, Large Straight, or Full House
  if (yahtzeeScore > 0 && availableCategories.includes('yahtzee')) {
    return { type: 'score', category: 'yahtzee' };
  }
  if (largeStraightScore > 0 && availableCategories.includes('largeStraight')) {
    return { type: 'score', category: 'largeStraight' };
  }
  if (fullHouseScore > 0 && availableCategories.includes('fullHouse')) {
    return { type: 'score', category: 'fullHouse' };
  }
  
  // If we have a great result but the specific category isn't available, score it in the best available category
  if (yahtzeeScore > 0 || largeStraightScore > 0 || fullHouseScore > 0) {
    return {
      type: 'score',
      category: makeScoreDecision(dice, availableCategories, playerState)
    };
  }
  
  // Otherwise, decide which dice to hold and reroll
  const holdPattern = makeHoldDecision(dice, rollCount, availableCategories);
  
  return {
    type: 'hold',
    holdPattern
  };
}