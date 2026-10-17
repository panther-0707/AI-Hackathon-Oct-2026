import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// MapLibre's CSS first so our overrides in index.css win at equal specificity
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
