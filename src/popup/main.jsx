import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '../index.css'

const mount = () => {
  const container = document.getElementById('root')
  if (container) {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } else {
    console.error('[UnfollowDel] #root element not found!')
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
