'use client'

import { AdvancedAnalyticsDashboard } from '@/components/analytics/AdvancedAnalyticsDashboard'
import { COPOAnalytics } from '@/components/analytics/COPOAnalytics'
import { CrossSemesterAnalytics } from '@/components/analytics/CrossSemesterAnalytics'
import { useState } from 'react'
import { 
  BarChart3, 
  Target, 
  LineChart, 
  Activity,
  TrendingUp,
  Users,
  BookOpen,
  Award
} from 'lucide-react'

export default function AnalyticsPage() {
  const [activeView, setActiveView] = useState<'overview' | 'copo' | 'cross-semester'>('overview')

  const analyticsViews = [
    { 
      id: 'overview', 
      name: 'Advanced Analytics', 
      icon: BarChart3,
      description: 'Real-time analytics, predictive insights, and system monitoring'
    },
    { 
      id: 'copo', 
      name: 'CO/PO Analytics', 
      icon: Target,
      description: 'Comprehensive Course and Program Outcomes analysis'
    },
    { 
      id: 'cross-semester', 
      name: 'Cross-Semester Analysis', 
      icon: LineChart,
      description: 'Compare performance across multiple semesters'
    }
  ]

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics & Insights</h1>
        <p className="text-gray-600">
          Comprehensive analytics dashboard with predictive insights and performance monitoring
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {analyticsViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === view.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <view.icon className="h-4 w-4 mr-2" />
              {view.name}
            </button>
          ))}
        </nav>
      </div>

      {/* View Description */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center">
          {analyticsViews.find(v => v.id === activeView)?.icon && (
            <div className="p-2 bg-blue-500 rounded-lg mr-3">
              {(() => {
                const Icon = analyticsViews.find(v => v.id === activeView)?.icon!
                return <Icon className="h-5 w-5 text-white" />
              })()}
            </div>
          )}
          <div>
            <h3 className="font-medium text-blue-900">
              {analyticsViews.find(v => v.id === activeView)?.name}
            </h3>
            <p className="text-sm text-blue-700">
              {analyticsViews.find(v => v.id === activeView)?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeView === 'overview' && <AdvancedAnalyticsDashboard />}
      {activeView === 'copo' && <COPOAnalytics />}
      {activeView === 'cross-semester' && <CrossSemesterAnalytics />}
    </div>
  )
}