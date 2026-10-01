import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AIProvider } from './context/AIContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AIProvider>
        <App />
      </AIProvider>
    </ToastProvider>
  </React.StrictMode>,
)
