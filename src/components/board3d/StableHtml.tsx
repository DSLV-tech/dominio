// ─── StableHtml ───────────────────────────────────────────────────────────────
// <Html> di drei con un contenitore DOM fisso (la .b3d-root della plancia).
//
// Perché: senza `portal`, drei aggancia le etichette al genitore della tela e
// poi, appena il sistema di eventi si collega, le sposta su un altro elemento.
// Lo spostamento ricrea la radice React dell'etichetta, ma il contenuto viene
// ridisegnato solo se l'etichetta si aggiorna: quelle che non cambiano (es. il
// gettone di Piazza Grande, i nomi delle zone) restavano vuote, a caso.
// Con un contenitore che esiste prima della tela il bersaglio non cambia mai.

import { useContext, type ComponentProps, type RefObject } from 'react';
import { Html } from '@react-three/drei';
import { HtmlPortalContext } from './htmlPortal';

export type StableHtmlProps = Omit<ComponentProps<typeof Html>, 'portal'>;

export function StableHtml(props: StableHtmlProps) {
  const portal = useContext(HtmlPortalContext);
  // RefObject<HTMLElement | null> → il tipo che drei si aspetta
  return <Html {...props} portal={portal ? (portal as RefObject<HTMLElement>) : undefined} />;
}
