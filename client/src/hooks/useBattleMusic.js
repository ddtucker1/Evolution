import { useEffect } from 'react';
import {
  pauseBattleMusic,
  playBossMusic,
  playGameplayMusic,
  stopBattleMusic,
  unpauseBattleMusic,
} from '../audio/gameAudio';

export default function useBattleMusic(screen, gameState) {
  useEffect(() => {
    if (screen !== 'battle') {
      stopBattleMusic();
      return undefined;
    }

    if (gameState?.gamePaused) {
      pauseBattleMusic();
      return undefined;
    }

    if (gameState?.bossPhase) {
      playBossMusic();
    } else {
      playGameplayMusic();
    }

    unpauseBattleMusic();

    return undefined;
  }, [screen, gameState?.bossPhase, gameState?.phase, gameState?.gamePaused]);
}
