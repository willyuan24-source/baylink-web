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
import './editorial-refinement.css'
import './components/local-discovery-detail.css'
import { pathLanguage, unprefixedPath } from './lib/language-path'
import { captureBootMain } from './app/boot-main'
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

/**
 * REG+2: a boot step failed (the page's code or its language did not load). The page must never look ready while doing
 * nothing, so a 16 px bar says so and offers a reload, in the URL's language (the dictionary may be what failed).
 */
const showBootRetryBar = () => {
  if (document.querySelector('.site-boot-retry')) return
  const words = { 'zh-Hans': ['部分功能没加载完', '重试'], 'zh-Hant': ['部分功能沒載入完', '重試'], en: ['Some features did not load', 'Retry'] }[pathLanguage(window.location.pathname)]
  const bar = document.createElement('div')
  bar.className = 'site-boot-retry'
  bar.setAttribute('role', 'alert')
  const text = document.createElement('span')
  text.textContent = words[0]
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = words[1]
  retry.addEventListener('click', () => window.location.reload())
  bar.append(text, retry)
  document.body.append(bar)
}

const path = unprefixedPath(window.location.pathname)
const loadPage: () => Promise<unknown> = currentPageLoader(path)
// The prerendered <main> stays on screen until the app's page renders (no blank frame at the swap).
captureBootMain()
void Promise.allSettled([initializeLocale(), loadPage()]).then(async ([language, page]) => {
  installProductObserver()
  // One more try for the page's code after a brief network drop or a deploy swapping files.
  const pageReady = page.status === 'fulfilled' || await new Promise(resolve => setTimeout(resolve, 1500)).then(() => loadPage()).then(() => true, () => false)
  if (pageReady) {
    // A dictionary that did not load leaves the page in 简体 (the app still works); say so.
    renderApp()
    if (language.status === 'rejected') showBootRetryBar()
    return
  }
  // The page's code is unreachable (offline?): keep the useful prerendered page and offer a reload; with nothing
  // prerendered, render the app, which shows its own loading and error states.
  if (!document.getElementById('root')?.hasChildNodes()) renderApp()
  showBootRetryBar()
})
