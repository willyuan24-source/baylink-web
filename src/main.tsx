import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageRouter } from './components/LanguageRouter'
import './index.css'
import './design.css'
import './features/member-ui.css'
import './features/profile/profile-personality.css'
import './features/profile/profile-personal-space.css'
import './styles/modern-messaging.css'
import './features/messages/chat-ai.css'
import './features/posts/posts-ui.css'
import './components/guides-ui.css'
import './components/guide-visuals.css'
import './components/guide-journal.css'
import './components/monthly-edition.css'
import './components/discovery-community.css'
import './components/monthly-discoveries.css'
import './components/regional-bulletins.css'
import './components/school-guide-topics.css'
import './components/monthly-deals.css'
import './components/freebie-board.css'
import './components/perks-gallery.css'
import './components/editorial-content.css'
import './components/product-improvements.css'
import './components/reader-library.css'
import './components/home-discovery.css'
import './components/about-baylink.css'
import './features/baybay-conversation.css'
import './features/outings/my-week-outings.css'
import './features/bookings/my-week-bookings.css'
import './components/outing-inspiration.css'
import './features/source-monitor/source-monitor.css'
import './styles/planner.css'
import './styles/discovery-workflow.css'
import './components/planner-web-library.css'
import './features/baybay-actions.css'
import './styles/event-import.css'
import './components/ai-local.css'
import './components/event-calendar.css'
import './components/calendar-event-map.css'
import './i18n/languages.css'
import { initializeLocale } from './i18n/locale'
import './i18n/metadata'
import App from './App.tsx'
import { currentPageLoader } from './route-loaders'
import { installChunkRecovery } from './lib/chunk-recovery'
import './audit-integration.css'
import './tokens.css'
import { unprefixedPath } from './lib/language-path'
installChunkRecovery()
import { installProductObserver } from './lib/product-observer'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { PageVisitObserver } from './components/PageVisitObserver'

const renderApp = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageRouter>
        <PageVisitObserver />
        <App />
      </LanguageRouter>
    </ErrorBoundary>
  </StrictMode>,
)

void Promise.all([initializeLocale(), currentPageLoader(unprefixedPath(window.location.pathname))()]).then(() => { installProductObserver(); renderApp() }).catch(() => {
  // Keep useful prerendered content if an offline visitor cannot load the interactive page.
  if (!document.getElementById('root')?.hasChildNodes()) renderApp()
})
