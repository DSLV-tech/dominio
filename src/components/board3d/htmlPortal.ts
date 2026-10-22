// Contenitore delle etichette HTML della plancia (fornito da GameBoard3D, usato da StableHtml).
import { createContext, type RefObject } from 'react';

export const HtmlPortalContext = createContext<RefObject<HTMLElement | null> | null>(null);
