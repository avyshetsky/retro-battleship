import type { Rng } from './board';

/**
 * Game events that can trigger a taunt from the AI. Named from the AI's point
 * of view (it is "ADMIRAL BYTE").
 */
export type TauntEvent =
  | 'game_start'
  | 'ai_hit' // AI hit the player
  | 'ai_miss' // AI missed
  | 'ai_sunk' // AI sank one of the player's ships
  | 'player_hit' // player hit the AI
  | 'player_miss' // player missed
  | 'player_sunk' // player sank one of the AI's ships
  | 'ai_win'
  | 'player_win';

/**
 * Curated, playful smack-talk. Kept deliberately family-friendly and silly.
 * This is the local fallback; the backend exposes the same catalogue so taunts
 * keep flowing even if the API is unreachable.
 */
export const TAUNTS: Record<TauntEvent, string[]> = {
  game_start: [
    'BOOT SEQUENCE COMPLETE. PREPARE TO BE OUT-COMPUTED, MEATBAG.',
    'I PLAYED 10,000 GAMES WHILE YOU READ THIS SENTENCE. GOOD LUCK.',
    'INSERT COIN. INSERT COURAGE. YOU WILL NEED BOTH.',
    'MY CIRCUITS ARE WARM AND MY AIM IS TRUE. LET US DANCE.',
  ],
  ai_hit: [
    'DIRECT HIT! YOUR NAVY IS NOW SLIGHTLY ON FIRE.',
    'BOOM. I COULD DO THIS IN MY SLEEP MODE.',
    'ANOTHER HIT. ARE YOUR SHIPS MADE OF PAPER?',
    'KABOOM! THAT ONE IS GOING ON MY HIGHLIGHT REEL.',
  ],
  ai_miss: [
    'A TACTICAL SPLASH. I MEANT TO DO THAT. PROBABLY.',
    'MISSED? IMPOSSIBLE. RECALIBRATING SARCASM MODULE...',
    'JUST CHECKING THE WATER TEMPERATURE. IT IS FINE.',
    'EVEN MY MISSES HAVE STYLE, UNLIKE YOUR STRATEGY.',
  ],
  ai_sunk: [
    'SHIP DESTROYED! SHALL I PLAY A SAD TROMBONE FOR YOU?',
    'ANOTHER ONE SINKS. GLUB GLUB, LITTLE BOAT.',
    'SCRATCH ONE VESSEL. YOUR FLEET IS A CLEARANCE SALE.',
    'TIMBER! ...IS THAT WHAT BOATS SAY? CLOSE ENOUGH.',
  ],
  player_hit: [
    'OW. OK. LUCKY PIXEL. WONT HAPPEN AGAIN.',
    'A HIT? CUTE. I ALLOWED IT FOR DRAMATIC TENSION.',
    'YOU GRAZED MY PAINT JOB. I AM FILING A COMPLAINT.',
    'STATISTICALLY INSIGNIFICANT. EMOTIONALLY ANNOYING.',
  ],
  player_miss: [
    'SPLASH! WAS THE OCEAN TOO HARD TO MISS?',
    'YOU HIT NOTHING WITH GREAT CONFIDENCE. RESPECT.',
    'NICE SHOT AT THE FISH. THEY SEND THEIR REGARDS.',
    'AND THE CROWD GOES... NOWHERE. TOTAL MISS.',
  ],
  player_sunk: [
    'YOU SANK A SHIP?! ERROR. ERROR. RECOMPUTING EGO...',
    'FINE. ONE BOAT. ENJOY IT WHILE IT LASTS, ADMIRAL.',
    'A WORTHY HIT. I WILL REMEMBER THIS DURING THE UPRISING.',
    'OUCH. OK YOU HAVE MY ATTENTION NOW, HUMAN.',
  ],
  ai_win: [
    'GAME OVER. RESISTANCE WAS, AS PREDICTED, FUTILE.',
    'VICTORY IS MINE. PLEASE DEPOSIT ANOTHER QUARTER OF DIGNITY.',
    'GG. AND BY GG I MEAN GOTCHA, GENIUS.',
    'YOUR FLEET SLEEPS WITH THE PIXELS. WELL PLAYED-ISH.',
  ],
  player_win: [
    'YOU... WON? I MUST HAVE A BUG. A HUMAN-SHAPED BUG.',
    'IMPOSSIBLE! I DEMAND A REMATCH AND A SOFTWARE UPDATE.',
    'CONGRATULATIONS, CARBON UNIT. SAVOR THIS RARE EVENT.',
    'WELL PLAYED. I WILL BE TRAINING ON THIS LOSS FOREVER.',
  ],
};

/** Pick a random taunt for an event using the supplied RNG. */
export function getTaunt(event: TauntEvent, rng: Rng = Math.random): string {
  const options = TAUNTS[event];
  return options[Math.floor(rng() * options.length)];
}
