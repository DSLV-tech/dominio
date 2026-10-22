// ─── CityLife ─────────────────────────────────────────────────────────────────
// Vita della città sulla plancia: traffico, barche, faro, gabbiani.
// Decorativa e isolata: se qualcosa va storto (dati corrotti, geometrie) il
// suo ErrorBoundary la spegne senza toccare la plancia giocabile.

import { memo, useMemo } from 'react';
import { ErrorBoundary } from '../../common/ErrorBoundary';
import { BOAT_ROUTES, GULL_FLOCKS, getTrafficData } from '../../../data';
import { Traffic } from './Traffic';
import { Boats } from './Boats';
import { Lighthouse } from './Lighthouse';
import { Gulls } from './Gulls';
import { useGraphicsBudget } from '../graphics';

interface CityLifeProps {
  readonly waterLevel: number;
}

const CityLifeContent = memo(function CityLifeContent({ waterLevel }: CityLifeProps) {
  const traffic = useMemo(() => getTrafficData(), []);
  const budget = useGraphicsBudget();
  return (
    <>
      <Traffic roads={traffic.roads} count={budget.cars} />
      <Boats routes={BOAT_ROUTES} waterLevel={waterLevel} />
      <Lighthouse lantern={traffic.lighthouse} />
      {budget.gulls && <Gulls flocks={GULL_FLOCKS} />}
    </>
  );
});

export const CityLife = memo(function CityLife(props: CityLifeProps) {
  return (
    <ErrorBoundary
      fallback={() => null}
      onError={error => console.warn('[CityLife] animazioni ambientali disattivate:', error.message)}
    >
      <CityLifeContent {...props} />
    </ErrorBoundary>
  );
});
