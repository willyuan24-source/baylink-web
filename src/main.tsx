import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './design.css'
import './features/member-ui.css'
import './features/profile/profile-personality.css'
import './styles/modern-messaging.css'
import './features/messages/chat-ai.css'
import './features/posts/posts-ui.css'
import './components/guides-ui.css'
import './components/guide-visuals.css'
import './components/guide-journal.css'
import './components/monthly-edition.css'
import './components/discovery-community.css'
import './components/monthly-discoveries.css'
import './components/monthly-deals.css'
import './components/freebie-board.css'
import './components/editorial-content.css'
import './components/product-improvements.css'
import './components/reader-library.css'
import './components/home-discovery.css'
import './components/about-baylink.css'
import './features/baybay-conversation.css'
import './features/source-monitor/source-monitor.css'
import './styles/planner.css'
import './styles/little-bay.css'
import './features/little-bay/sf-exploration.css'
import './features/little-bay/sf-landmark-photo.css'
import './features/little-bay/bay-atlas.css'
import './features/little-bay/regional-world.css'
import './features/little-bay/unified-bay.css'
import './features/little-bay/unified-bay-panels.css'
import './features/little-bay/bay-immersion.css'
import './features/little-bay/bay-discoveries.css'
import './features/baybay-actions.css'
import './styles/event-import.css'
import './components/ai-local.css'
import './components/event-calendar.css'
import './components/calendar-event-map.css'
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
