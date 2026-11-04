import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { loadLook, applyLook } from './lib/look';

applyLook(loadLook());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
