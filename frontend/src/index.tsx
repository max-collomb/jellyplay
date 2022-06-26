import React from 'react';
import ReactDOM from 'react-dom';
import App from './app';


import 'bootstrap-dark-5/dist/css/bootstrap-nightshade.min.css';
import './style.css';

declare global {
  var _mpvSchemeSupported: boolean;
  var _setPosition: (position: number) => void;
}

ReactDOM.render(<App />, document.getElementById('root'));