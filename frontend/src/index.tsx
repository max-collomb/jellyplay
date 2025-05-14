/* eslint-disable @typescript-eslint/naming-convention */
import React from 'react';
import ReactDOM from 'react-dom';
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

ReactDOM.render(<App />, document.getElementById('root'));
