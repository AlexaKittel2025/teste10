# Level System and Rewards Integration Summary

## Overview
The level system and rewards have been fully integrated with the new-game page. Players now earn XP and loyalty points from their bets and receive bonus multipliers based on their level.

## Changes Made

### 1. Place Bet API (`/api/games/place-bet.ts`)
- Added `addBetRewards` function import from levelSystem
- After successful bet placement, rewards are processed:
  - XP is awarded for placing a bet
  - Level-up information is returned in the response
- Response now includes level data:
  ```json
  {
    "level": {
      "addedXP": 10,
      "addedPoints": 5,
      "levelUp": false,
      "newLevel": null
    }
  }
  ```

### 2. Cash Out API (`/api/games/cash-out.ts`)
- Added imports for `getUserBonusMultiplier` and `applyLevelBonusToMultiplier`
- Fetches user's level bonus multiplier before calculating winnings
- Applies bonus to the game multiplier:
  - Example: 2.5x multiplier + 5% level bonus = 2.625x final multiplier
- Awards XP and loyalty points for successful cash-outs (wins)
- Response includes bonus information:
  ```json
  {
    "originalMultiplier": 2.5,
    "finalMultiplier": 2.625,
    "bonusMultiplier": 0.05,
    "level": {
      "addedXP": 25,
      "addedPoints": 12,
      "levelUp": true,
      "newLevel": 3
    }
  }
  ```

### 3. GameActions.ts Updates
- Modified `placeBet` function to handle level rewards response
- Updated `cashOut` function to:
  - Use server-provided final multiplier (with bonus included)
  - Process level rewards data
  - Log level-up events
  - Display bonus application
- Fixed betId compatibility issue

### 4. Frontend Integration
- Level rewards are now processed on both bet placement and cash-out
- Console logs show when bonuses are applied
- Level-up events are logged (TODO: Add visual notifications)

## How It Works

1. **Placing a Bet**:
   - User places a bet through the UI
   - API deducts balance and creates bet record
   - Level system awards XP for the bet
   - Response includes level progress

2. **Cashing Out**:
   - User cashes out at a certain multiplier
   - API fetches user's level bonus multiplier
   - Final multiplier = game multiplier × (1 + level bonus)
   - Winnings calculated with bonus included
   - XP and loyalty points awarded for the win
   - Balance updated with bonus-enhanced winnings

3. **Level Bonuses**:
   - Each level provides a permanent multiplier bonus
   - Bonus increases with level (e.g., Level 2: +2%, Level 5: +5%)
   - Applied automatically to all cash-outs

## Example Flow

1. User at Level 3 (3% bonus) places R$10 bet
2. User receives 10 XP for placing the bet
3. User cashes out at 2.00x
4. Final multiplier: 2.00 × 1.03 = 2.06x
5. Winnings: R$10 × 2.06 = R$20.60
6. User receives 25 XP and 12 loyalty points for winning
7. If XP threshold met, user levels up to Level 4

## Future Enhancements

1. Add visual notifications for level-ups
2. Show bonus multiplier in the UI during gameplay
3. Add temporary boosts from redeemed rewards
4. Implement daily limit boosts from rewards
5. Add achievement system integration