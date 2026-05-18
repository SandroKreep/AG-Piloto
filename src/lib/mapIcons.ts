import L from 'leaflet'

export const iconeUsuario = L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 24px; height: 24px;">
      <!-- Pulso externo -->
      <div style="
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 40px; height: 40px;
        border-radius: 50%;
        background: rgba(66, 133, 244, 0.25);
        animation: pulse 2s infinite;
      "></div>
      <!-- Círculo azul principal -->
      <div style="
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 18px; height: 18px;
        border-radius: 50%;
        background: #4285F4;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
    </style>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

export const iconeDestino = L.divIcon({
  className: '',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
      <defs>
        <radialGradient id="grad2" cx="40%" cy="35%" r="60%">
          <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#c0392b;stop-opacity:1" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="50" rx="8" ry="3" fill="rgba(0,0,0,0.25)"/>
      <path d="M20 2 C10 2 2 10 2 20 C2 32 20 48 20 48 C20 48 38 32 38 20 C38 10 30 2 20 2 Z"
            fill="url(#grad2)" stroke="#a93226" stroke-width="1"/>
      <circle cx="20" cy="19" r="8" fill="white" opacity="0.95"/>
      <ellipse cx="16" cy="14" rx="4" ry="3" fill="white" opacity="0.3"/>
    </svg>
  `,
  iconSize: [40, 52],
  iconAnchor: [20, 52],
  popupAnchor: [0, -52]
})
