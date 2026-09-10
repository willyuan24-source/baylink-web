import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './design.css'
import './features/member-ui.css'
import './features/profile/profile-personality.css'
import './styles/modern-messaging.css'
import './features/posts/posts-ui.css'
import './components/guides-ui.css'
import './components/guide-visuals.css'
import './components/guide-journal.css'
import './components/monthly-edition.css'
import './components/monthly-deals.css'
import './components/freebie-board.css'
import './components/editorial-content.css'
import './components/product-improvements.css'
import './components/reader-library.css'
import './components/home-discovery.css'
import './features/baybay-conversation.css'
import './i18n/languages.css'
import { initializeLocale } from './i18n/locale'
import './i18n/metadata'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

const renderApp = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

void initializeLocale().catch(() => { /* The original language remains readable if a chunk fails. */ }).finally(renderApp)
