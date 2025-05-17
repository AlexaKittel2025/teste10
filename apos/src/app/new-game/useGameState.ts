import { useState, useCallback } from 'react';
import {
  GamePhase,
  PlacedBet,
  GameResult,
  BETTING_PHASE_DURATION,
  GAME_PHASE_DURATION,
  INITIAL_MULTIPLIER,
  MIN_BET_AMOUNT
} from './constants';

export const useGameState = () => {
  // Estados do jogo
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('betting');
  const [timeLeft, setTimeLeft] = useState(BETTING_PHASE_DURATION);
  const [currentMultiplier, setCurrentMultiplier] = useState(INITIAL_MULTIPLIER);
  const [multiplierHistory, setMultiplierHistory] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState<number>(MIN_BET_AMOUNT);
  const [placedBet, setPlacedBet] = useState<PlacedBet | null>(null);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResults, setLastResults] = useState<GameResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [playerCount, setPlayerCount] = useState(1);

  // Reset game state for new round
  const resetForNewRound = useCallback(() => {
    setTimeLeft(BETTING_PHASE_DURATION);
    setCurrentMultiplier(INITIAL_MULTIPLIER);
    setPlacedBet(null);
    setCashedOut(false);
    setCashOutMultiplier(null);
    setWinAmount(null);
    setErrorMessage(null);
    setMultiplierHistory([]);
  }, []);

  // Update game state from server
  const updateGameState = useCallback((state: any) => {
    setCurrentPhase(state.phase);
    
    if (typeof state.timeLeft === 'number') {
      setTimeLeft(Math.ceil(state.timeLeft / 1000));
    }
    
    if (typeof state.multiplier === 'number' && !isNaN(state.multiplier)) {
      setCurrentMultiplier(state.multiplier);
    }
    
    setRoundId(state.roundId);
    setAllBets(state.bets || []);
    setPlayerCount(state.connectedPlayers || 1);
    
    // Se o jogo estiver em andamento, ajustar o tempo de início
    if (state.phase === 'running') {
      setGameStartTime(Date.now() - (((GAME_PHASE_DURATION * 1000) - state.timeLeft)));
    }
  }, []);

  // Handle phase change
  const handlePhaseChange = useCallback((phase: GamePhase) => {
    setCurrentPhase(phase);
    
    if (phase === 'betting') {
      resetForNewRound();
    } else if (phase === 'running') {
      setTimeLeft(GAME_PHASE_DURATION);
      setGameStartTime(Date.now());
      setMultiplierHistory([INITIAL_MULTIPLIER]);
    }
  }, [resetForNewRound]);

  // Update multiplier and history
  const updateMultiplier = useCallback((value: number) => {
    setCurrentMultiplier(value);
    setMultiplierHistory(prev => [...prev, value]);
  }, []);

  // Add result to history
  const addResult = useCallback((multiplier: number) => {
    setLastResults(prev => [{
      multiplier,
      timestamp: Date.now()
    }, ...prev.slice(0, 9)]);
  }, []);

  return {
    // Estados
    currentPhase,
    timeLeft,
    currentMultiplier,
    multiplierHistory,
    betAmount,
    placedBet,
    cashedOut,
    cashOutMultiplier,
    winAmount,
    isLoading,
    lastResults,
    errorMessage,
    roundId,
    gameStartTime,
    allBets,
    playerCount,
    
    // Setters
    setCurrentPhase,
    setTimeLeft,
    setCurrentMultiplier,
    setBetAmount,
    setPlacedBet,
    setCashedOut,
    setCashOutMultiplier,
    setWinAmount,
    setIsLoading,
    setErrorMessage,
    setRoundId,
    setAllBets,
    setPlayerCount,
    
    // Funções de controle
    resetForNewRound,
    updateGameState,
    handlePhaseChange,
    updateMultiplier,
    addResult
  };
};