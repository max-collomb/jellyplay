/* eslint-disable @typescript-eslint/naming-convention */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';

import 'bootstrap-dark-5/dist/css/bootstrap-nightshade.min.css';
import './style.css';

declare global {
  interface Window {
    _mpvSchemeSupported: boolean;
    _positions: { [key: string]: number };
    _setPosition: (position: number) => void;
    _exited: () => void;
    electronAPI: {
      checkForUpdates: () => void;
    }
  }
}
window._positions = {};

window._exited = () => {};

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
