import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary, { journaliserErreurRenderer } from './components/ErrorBoundary';

window.addEventListener('error', (event) => {
  journaliserErreurRenderer('window:error', event.error || new Error(event.message));
});
window.addEventListener('unhandledrejection', (event) => {
  journaliserErreurRenderer('window:unhandledrejection', event.reason);
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
