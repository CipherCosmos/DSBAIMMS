'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, FileText, BarChart3, Users, BookOpen, Calendar, Filter, Search, Eye, RefreshCw } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Report {
  id: string
  type: string
  title: string
  description: string
  status: 'generating' | 'completed' | 'failed'
  created_at: string
  file_url?: string
  parameters: any
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  category: string
  parameters: any[]
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [reportParams, setReportParams] = useState<any>({})
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)

  useEffect(() => {
    loadReports()
    loadTemplates()
  }, [])

  const loadReports = async () => {
    try {
      setLoading(true)
      // This would be implemented when the backend has a reports endpoint
      setReports([])
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = () => {
    // Mock templates - in real implementation, these would come from the backend
    setTemplates([
      {
        id: 'student_performance',
        name: 'Student Performance Report',
        description: 'Comprehensive student performance analysis',
        category: 'Academic',
        parameters: [
          { name: 'student_id', type: 'select', label: 'Student', required: false },
          { name: 'subject_id', type: 'select', label: 'Subject', required: false },
          { name: 'date_from', type: 'date', label: 'From Date', required: false },
          { name: 'date_to', type: 'date', label: 'To Date', required: false }
        ]
      },
      {
        id: 'co_attainment',
        name: 'CO Attainment Report',
        description: 'Course Outcome attainment analysis',
        category: 'Academic',
        parameters: [
          { name: 'subject_id', type: 'select', label: 'Subject', required: true },
          { name: 'exam_id', type: 'select', label: 'Exam', required: false },
          { name: 'threshold', type: 'number', label: 'Threshold (%)', required: false }
        ]
      },
      {
        id: 'po_attainment',
        name: 'PO Attainment Report',
        description: 'Program Outcome attainment analysis',
        category: 'Academic',
        parameters: [
          { name: 'department_id', type: 'select', label: 'Department', required: true },
          { name: 'year', type: 'number', label: 'Academic Year', required: false }
        ]
      },
      {
        id: 'exam_analysis',
        name: 'Exam Analysis Report',
        description: 'Detailed exam performance analysis',
        category: 'Academic',
        parameters: [
          { name: 'exam_id', type: 'select', label: 'Exam', required: true },
          { name: 'include_questions', type: 'checkbox', label: 'Include Question Analysis', required: false }
        ]
      },
      {
        id: 'user_activity',
        name: 'User Activity Report',
        description: 'System usage and activity report',
        category: 'System',
        parameters: [
          { name: 'user_id', type: 'select', label: 'User', required: false },
          { name: 'date_from', type: 'date', label: 'From Date', required: true },
          { name: 'date_to', type: 'date', label: 'To Date', required: true }
        ]
      },
      {
        id: 'comprehensive',
        name: 'Comprehensive Report',
        description: 'Complete system overview report',
        category: 'System',
        parameters: [
          { name: 'department_id', type: 'select', label: 'Department', required: false },
          { name: 'include_analytics', type: 'checkbox', label: 'Include Analytics', required: false }
        ]
      }
    ])
  }

  const handleGenerateReport = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a report template')
      return
    }

    setGenerating(true)
    try {
      const result = await apiClient.generateReport()
      toast.success('Report generation started')
      setShowGenerateDialog(false)
      loadReports()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadReport = async (reportId: string) => {
    try {
      const blob = await apiClient.downloadReport()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${reportId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      toast.error(error.detail || 'Failed to download report')
    }
  }

  const handleExportData = async (format: string, type: string) => {
    try {
      let blob
      switch (type) {
        case 'users':
          blob = await apiClient.exportUsers(format)
          break
        case 'marks':
          blob = await apiClient.exportMarks(parseInt(reportParams.exam_id), format)
          break
        case 'co_attainment':
          blob = await apiClient.exportCOAttainment(format, reportParams)
          break
        case 'comprehensive':
          blob = await apiClient.exportComprehensiveReport(format, reportParams)
          break
        default:
          toast.error('Invalid export type')
          return
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch (error: any) {
      toast.error(error.detail || 'Failed to export data')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generating':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Academic':
        return <BookOpen className="h-5 w-5 text-blue-600" />
      case 'System':
        return <BarChart3 className="h-5 w-5 text-green-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-600">Generate and download comprehensive reports</p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)}>
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {/* Quick Export Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleExportData('csv', 'users')}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Export Users</p>
                <p className="text-xs text-gray-400">CSV Format</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleExportData('csv', 'marks')}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Export Marks</p>
                <p className="text-xs text-gray-400">CSV Format</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleExportData('pdf', 'comprehensive')}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Comprehensive Report</p>
                <p className="text-xs text-gray-400">PDF Format</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleExportData('xlsx', 'co_attainment')}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">CO Attainment</p>
                <p className="text-xs text-gray-400">Excel Format</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Report Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates && Array.isArray(templates) && templates.map((template) => (
              <div
                key={template.id}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedTemplate(template.id)
                  setShowGenerateDialog(true)
                }}
              >
                <div className="flex items-start gap-3">
                  {getCategoryIcon(template.category)}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    <Badge variant="outline" className="mt-2">
                      {template.category}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generated Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {reports && Array.isArray(reports) && reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports generated yet</h3>
              <p className="text-gray-600">Generate your first report to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports && Array.isArray(reports) && reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-900">{report.title}</h4>
                      <p className="text-sm text-gray-600">{report.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReport(report.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Report Dialog */}
      {showGenerateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Generate Report</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Template</option>
                  {templates && Array.isArray(templates) && templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.parameters.map((param, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {param.label} {param.required && '*'}
                  </label>
                  {param.type === 'select' ? (
                    <select
                      value={reportParams[param.name] || ''}
                      onChange={(e) => setReportParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select {param.label}</option>
                      {/* Options would be populated based on the parameter type */}
                    </select>
                  ) : param.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={reportParams[param.name] || false}
                      onChange={(e) => setReportParams(prev => ({ ...prev, [param.name]: e.target.checked }))}
                      className="mr-2"
                    />
                  ) : (
                    <Input
                      type={param.type}
                      value={reportParams[param.name] || ''}
                      onChange={(e) => setReportParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                      required={param.required}
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleGenerateReport}
                  disabled={generating || !selectedTemplate}
                  className="flex-1"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowGenerateDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}