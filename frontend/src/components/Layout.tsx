import { useEffect, useState, type ReactNode } from 'react'

import { api } from '../services/api'
import type { SiteConfig } from '../lib/types'
import { Footer } from './Footer'
import { Header } from './Header'

export function Layout({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig | null>(null)

  useEffect(() => {
    api
      .get<SiteConfig>('/public/config/')
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {config?.maintenance_mode ? (
        <div className="maintenance-banner" role="status">
          ⚠️ {config.maintenance_message}
        </div>
      ) : null}
      <Header />
      <main id="main" className="page-body">
        {children}
      </main>
      <Footer />
    </div>
  )
}
