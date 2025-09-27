// Analytics and user behavior tracking
export interface AnalyticsEvent {
  id: string
  name: string
  category: string
  action: string
  label?: string
  timestamp: Date
  properties: Record<string, any>
  user: {
    id?: string
    role?: string
    sessionId?: string
  }
  context: {
    url: string
    referrer?: string
    userAgent: string
    viewport: {
      width: number
      height: number
    }
    timestamp: Date
  }
}

export interface UserSession {
  id: string
  startTime: Date
  endTime?: Date
  duration?: number
  pageViews: number
  events: AnalyticsEvent[]
  user: {
    id?: string
    role?: string
  }
  device: {
    userAgent: string
    viewport: { width: number; height: number }
    platform: string
  }
}

export interface PageView {
  id: string
  url: string
  title: string
  timestamp: Date
  duration?: number
  referrer?: string
  user: {
    id?: string
    role?: string
  }
  session: {
    id: string
    startTime: Date
  }
}

export interface FeatureUsage {
  feature: string
  count: number
  lastUsed: Date
  users: Set<string>
  averageTime: number
  successRate: number
}

// Analytics service
export class AnalyticsService {
  private static instance: AnalyticsService
  private events: AnalyticsEvent[] = []
  private sessions: Map<string, UserSession> = new Map()
  private pageViews: PageView[] = []
  private featureUsage: Map<string, FeatureUsage> = new Map()
  private currentSession: UserSession | null = null
  private maxEvents = 1000
  private maxSessions = 100
  private maxPageViews = 500

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService()
    }
    return AnalyticsService.instance
  }

  constructor() {
    this.initializeAnalytics()
  }

  private initializeAnalytics(): void {
    if (typeof window === 'undefined') return

    // Start new session
    this.startSession()
    
    // Track page views
    this.trackPageView()
    
    // Track user interactions
    this.trackUserInteractions()
    
    // Track feature usage
    this.trackFeatureUsage()
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.endSession()
    })
  }

  private startSession(): void {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      pageViews: 0,
      events: [],
      user: {
        // This would be populated from your auth system
        id: undefined,
        role: undefined,
      },
      device: {
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        platform: navigator.platform,
      },
    }
    
    this.sessions.set(sessionId, this.currentSession)
    
    // Track session start
    this.trackEvent('session', 'start', 'session_started', undefined, {
      sessionId,
      startTime: this.currentSession.startTime,
    })
  }

  private endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = new Date()
      this.currentSession.duration = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime()
      
      // Track session end
      this.trackEvent('session', 'end', 'session_ended', undefined, {
        sessionId: this.currentSession.id,
        duration: this.currentSession.duration,
        pageViews: this.currentSession.pageViews,
        eventCount: this.currentSession.events.length,
      })
      
      this.currentSession = null
    }
  }

  private trackPageView(): void {
    const pageView: PageView = {
      id: `pageview_${Date.now()}`,
      url: window.location.href,
      title: document.title,
      timestamp: new Date(),
      referrer: document.referrer,
      user: {
        // This would be populated from your auth system
        id: undefined,
        role: undefined,
      },
      session: {
        id: this.currentSession?.id || '',
        startTime: this.currentSession?.startTime || new Date(),
      },
    }
    
    this.pageViews.unshift(pageView)
    if (this.pageViews.length > this.maxPageViews) {
      this.pageViews = this.pageViews.slice(0, this.maxPageViews)
    }
    
    if (this.currentSession) {
      this.currentSession.pageViews++
    }
    
    // Track page view event
    this.trackEvent('page', 'view', 'page_viewed', pageView.url, {
      title: pageView.title,
      referrer: pageView.referrer,
    })
  }

  private trackUserInteractions(): void {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as Element
      this.trackEvent('interaction', 'click', 'element_clicked', target.tagName, {
        tagName: target.tagName,
        className: target.className,
        id: target.id,
        x: event.clientX,
        y: event.clientY,
      })
    })

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement
      this.trackEvent('form', 'submit', 'form_submitted', form.id || 'unknown', {
        formId: form.id,
        formClass: form.className,
        action: form.action,
        method: form.method,
      })
    })

    // Track input focus
    document.addEventListener('focus', (event) => {
      const target = event.target as Element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        this.trackEvent('interaction', 'focus', 'input_focused', target.tagName, {
          tagName: target.tagName,
          type: (target as HTMLInputElement).type,
          name: (target as HTMLInputElement).name,
        })
      }
    }, true)

    // Track scroll depth
    let maxScrollDepth = 0
    window.addEventListener('scroll', () => {
      const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth
        this.trackEvent('engagement', 'scroll', 'scroll_depth', maxScrollDepth.toString(), {
          depth: maxScrollDepth,
          scrollY: window.scrollY,
        })
      }
    })

    // Track time on page
    let timeOnPage = 0
    setInterval(() => {
      timeOnPage += 10
      if (timeOnPage % 30 === 0) { // Track every 30 seconds
        this.trackEvent('engagement', 'time', 'time_on_page', timeOnPage.toString(), {
          seconds: timeOnPage,
        })
      }
    }, 10000)
  }

  private trackFeatureUsage(): void {
    // This would be implemented based on your specific features
    // For now, we'll track common LMS features
    const features = [
      'dashboard',
      'users',
      'departments',
      'classes',
      'subjects',
      'exams',
      'analytics',
      'reports',
      'files',
      'notifications',
    ]

    features.forEach(feature => {
      // Track feature access
      const originalPushState = history.pushState
      history.pushState = function(...args) {
        const url = args[2] as string
        if (url && url.includes(feature)) {
          AnalyticsService.getInstance().trackEvent('feature', 'access', 'feature_accessed', feature, {
            url,
            timestamp: new Date(),
          })
        }
        return originalPushState.apply(history, args)
      }
    })
  }

  // Public methods
  trackEvent(
    category: string,
    action: string,
    name: string,
    label?: string,
    properties: Record<string, any> = {}
  ): void {
    const event: AnalyticsEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      category,
      action,
      label,
      timestamp: new Date(),
      properties,
      user: {
        // This would be populated from your auth system
        id: undefined,
        role: undefined,
      },
      context: {
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        timestamp: new Date(),
      },
    }

    this.events.unshift(event)
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents)
    }

    if (this.currentSession) {
      this.currentSession.events.push(event)
    }

    // Update feature usage
    this.updateFeatureUsage(category, action, name, properties)

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics event:', event)
    }

    // Send to external analytics service
    this.sendToExternalService(event)
  }

  private updateFeatureUsage(category: string, action: string, name: string, properties: Record<string, any>): void {
    if (category === 'feature') {
      const feature = properties.feature || name
      const existing = this.featureUsage.get(feature)
      
      if (existing) {
        existing.count++
        existing.lastUsed = new Date()
        existing.users.add(this.currentSession?.user.id || 'anonymous')
        existing.averageTime = (existing.averageTime + (properties.duration || 0)) / 2
      } else {
        this.featureUsage.set(feature, {
          feature,
          count: 1,
          lastUsed: new Date(),
          users: new Set([this.currentSession?.user.id || 'anonymous']),
          averageTime: properties.duration || 0,
          successRate: 100,
        })
      }
    }
  }

  private sendToExternalService(event: AnalyticsEvent): void {
    // This would be implemented based on your analytics service
    // Examples: Google Analytics, Mixpanel, Amplitude, etc.
    
    // Example for Google Analytics 4:
    // gtag('event', event.action, {
    //   event_category: event.category,
    //   event_label: event.label,
    //   value: event.value,
    //   custom_parameters: event.properties,
    // })

    // Example for custom API:
    // fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(event),
    // }).catch(err => {
    //   console.error('Failed to send analytics event:', err)
    // })
  }

  // Analytics queries and reports
  getEvents(category?: string, action?: string, limit = 100): AnalyticsEvent[] {
    let filtered = this.events
    
    if (category) {
      filtered = filtered.filter(event => event.category === category)
    }
    
    if (action) {
      filtered = filtered.filter(event => event.action === action)
    }
    
    return filtered.slice(0, limit)
  }

  getSessions(limit = 50): UserSession[] {
    return Array.from(this.sessions.values()).slice(0, limit)
  }

  getPageViews(limit = 100): PageView[] {
    return this.pageViews.slice(0, limit)
  }

  getFeatureUsage(): FeatureUsage[] {
    return Array.from(this.featureUsage.values())
  }

  getTopFeatures(limit = 10): FeatureUsage[] {
    return this.getFeatureUsage()
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  getSessionDuration(): { average: number; total: number; count: number } {
    const sessions = this.getSessions()
    const completedSessions = sessions.filter(s => s.duration)
    
    if (completedSessions.length === 0) {
      return { average: 0, total: 0, count: 0 }
    }
    
    const total = completedSessions.reduce((sum, session) => sum + (session.duration || 0), 0)
    const average = total / completedSessions.length
    
    return { average, total, count: completedSessions.length }
  }

  getPageViewStats(): { total: number; unique: number; average: number } {
    const pageViews = this.getPageViews()
    const unique = new Set(pageViews.map(pv => pv.url)).size
    
    return {
      total: pageViews.length,
      unique,
      average: pageViews.length / this.sessions.size,
    }
  }

  getUserEngagement(): {
    clicks: number
    scrolls: number
    forms: number
    timeOnPage: number
  } {
    const events = this.getEvents()
    
    return {
      clicks: events.filter(e => e.category === 'interaction' && e.action === 'click').length,
      scrolls: events.filter(e => e.category === 'engagement' && e.action === 'scroll').length,
      forms: events.filter(e => e.category === 'form' && e.action === 'submit').length,
      timeOnPage: events
        .filter(e => e.category === 'engagement' && e.action === 'time')
        .reduce((sum, e) => sum + 0, 0), // Removed value property
    }
  }

  clearData(): void {
    this.events = []
    this.sessions.clear()
    this.pageViews = []
    this.featureUsage.clear()
  }

  exportData(): {
    events: AnalyticsEvent[]
    sessions: UserSession[]
    pageViews: PageView[]
    featureUsage: FeatureUsage[]
  } {
    return {
      events: this.events,
      sessions: Array.from(this.sessions.values()),
      pageViews: this.pageViews,
      featureUsage: Array.from(this.featureUsage.values()),
    }
  }
}

// Analytics utilities
export const analyticsUtils = {
  // Track feature usage
  trackFeature: (feature: string, action: string = 'access', properties: Record<string, any> = {}) => {
    AnalyticsService.getInstance().trackEvent('feature', action, 'feature_used', feature, {
      feature,
      ...properties,
    })
  },

  // Track user action
  trackAction: (action: string, category: string = 'user', properties: Record<string, any> = {}) => {
    AnalyticsService.getInstance().trackEvent(category, action, 'user_action', action, properties)
  },

  // Track page view
  trackPage: (page: string, properties: Record<string, any> = {}) => {
    AnalyticsService.getInstance().trackEvent('page', 'view', 'page_viewed', page, properties)
  },

  // Track error
  trackError: (error: string, context: string = 'unknown', properties: Record<string, any> = {}) => {
    AnalyticsService.getInstance().trackEvent('error', 'occurred', 'error_tracked', error, {
      error,
      context,
      ...properties,
    })
  },

  // Track performance
  trackPerformance: (metric: string, value: number, properties: Record<string, any> = {}) => {
    AnalyticsService.getInstance().trackEvent('performance', 'measured', 'performance_tracked', metric, {
      metric,
      value,
      ...properties,
    })
  },

  // Get analytics summary
  getSummary: () => {
    const service = AnalyticsService.getInstance()
    return {
      totalEvents: service.getEvents().length,
      totalSessions: service.getSessions().length,
      totalPageViews: service.getPageViews().length,
      topFeatures: service.getTopFeatures(5),
      sessionDuration: service.getSessionDuration(),
      pageViewStats: service.getPageViewStats(),
      userEngagement: service.getUserEngagement(),
    }
  },
}

// Initialize analytics
if (typeof window !== 'undefined') {
  AnalyticsService.getInstance()
}
