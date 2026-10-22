// ─── CombatDice2D ─────────────────────────────────────────────────────────────
// Dadi 2D di riserva: usati quando WebGL manca o l'arena 3D fallisce.
// Stessa interfaccia dell'arena (onStage), così il modale non cambia.
// Durate: 500 ms di rotolamento → 220 ms di assestamento → esito.

import { memo, useEffect, useRef, useState } from 'react';
import { audio } from '../../audio/engine';
import type { CombatSideView, CombatStage, CombatView, DieVerdict } from '../../types';

interface AnimatedDieProps {
  readonly finalValue: number;
  readonly verdict: DieVerdict;
  readonly delayMs: number;
  readonly speed: number;
  readonly tone: 'attack' | 'defense';
}

const AnimatedDie = memo(function AnimatedDie({ finalValue, verdict, delayMs, speed, tone }: AnimatedDieProps) {
  const [displayValue, setDisplayValue] = useState<number>(() => Math.ceil(Math.random() * 6));
  const [phase, setPhase] = useState<'rolling' | 'settling' | 'settled'>('rolling');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => {
      let ticks = 0;
      intervalRef.current = setInterval(() => {
        setDisplayValue(Math.ceil(Math.random() * 6));
        ticks++;
        if (ticks >= 14) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase('settling');
          setDisplayValue(finalValue);
          audio.play('diceHit', { intensity: 0.7 });
          timers.push(setTimeout(() => setPhase('settled'), 220 / speed));
        }
      }, 36 / speed);
    }, delayMs / speed));
    return () => {
      timers.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [finalValue, delayMs, speed]);

  const state = phase !== 'settled' ? 'rolling' : verdict === true ? 'won' : verdict === false ? 'lost' : 'idle';
  return (
    <div className={`die2d die2d--${tone} is-${state}${phase === 'settling' ? ' is-settling' : ''}`} aria-hidden="true">
      {displayValue}
    </div>
  );
});

function DiceRow({ side, speed, offset }: { readonly side: CombatSideView; readonly speed: number; readonly offset: number }) {
  return (
    <div className="die2d-row">
      {side.dice.map((d, i) => (
        <AnimatedDie
          key={i}
          finalValue={d}
          verdict={side.verdicts[i] ?? null}
          delayMs={offset + i * 80}
          speed={speed}
          tone={side.side === 'attacker' ? 'attack' : 'defense'}
        />
      ))}
    </div>
  );
}

interface CombatDice2DProps {
  readonly view: CombatView;
  readonly skipToken: number;
  readonly onStage: (stage: CombatStage) => void;
}

export const CombatDice2D = memo(function CombatDice2D({ view, skipToken, onStage }: CombatDice2DProps) {
  const firstSkip = useRef(skipToken);

  useEffect(() => {
    const k = 1 / view.speed;
    audio.play('diceShake');
    const ts = [
      setTimeout(() => onStage('roll'), 0),
      setTimeout(() => onStage('compare'), 760 * k),
      setTimeout(() => { onStage('result'); audio.play(view.conquered ? 'conquest' : 'repelled'); }, 980 * k),
    ];
    return () => ts.forEach(clearTimeout);
  }, [view, onStage]);

  useEffect(() => {
    if (skipToken !== firstSkip.current) onStage('result');
  }, [skipToken, onStage]);

  return (
    <div className="die2d-stage">
      <DiceRow side={view.attacker} speed={view.speed} offset={0} />
      <span className="die2d-vs" aria-hidden="true">VS</span>
      <DiceRow side={view.defender} speed={view.speed} offset={60} />
    </div>
  );
});
