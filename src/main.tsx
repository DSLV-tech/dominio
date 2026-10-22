import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/animations.css'
import App from './App.tsx'
import './pwa/install'   // service worker + prompt d'installazione

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

