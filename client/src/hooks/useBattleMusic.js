import { useEffect } from 'react';
import { playBossMusic, playGameplayMusic, stopBattleMusic } from '../audio/gameAudio';

export default function useBattleMusic(screen, gameState) {
  useEffect(() => {
    if (screen !== 'battle') {
      stopBattleMusic();
      return undefined;
    }

    if (gameState?.bossPhase) {
      playBossMusic();
    } else {
      playGameplayMusic();
    }

    return undefined;
  }, [screen, gameState?.bossPhase, gameState?.phase]);
}
