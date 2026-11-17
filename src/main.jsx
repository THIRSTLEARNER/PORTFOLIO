import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

// Privacy-friendly analytics (Umami), only when a website ID is configured.
// Set VITE_UMAMI_WEBSITE_ID in your environment to enable; no cookies, no personal data.
const umamiId = import.meta.env.VITE_UMAMI_WEBSITE_ID
if (umamiId) {
  const script = document.createElement('script')
  script.defer = true
  script.src = 'https://cloud.umami.is/script.js'
  script.setAttribute('data-website-id', umamiId)
  document.head.appendChild(script)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
