'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  FileText, Download, RefreshCw, Filter, Search, Calendar,
  BarChart3, PieChart, TrendingUp, Users, BookOpen, Award,
  Building, Target, Clock, Eye, Settings, Plus, Edit, Trash2
} from 'lucide-react'

interface Report {
  id: number
  name: string
  description: string
  type: string
  category: string
  parameters: Record<string, any>
  created_by: number
  created_by_name?: string
  is_public: boolean
  last_generated?: string
  file_path?: string
  file_size?: number
  created_at: string
  updated_at?: string
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  category: string
  parameters: string[]
  icon: any
}

interface ReportData {
  title: string
  data: any[]
  summary: Record<string, any>
  generated_at: string
  parameters: Record<string, any>
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [generatingReport, setGeneratingReport] = useState<number | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    category: '',
    parameters: {} as Record<string, any>,
    is_public: false
  })

  const reportTemplates: ReportTemplate[] = [
    {
      id: 'student-performance',
      name: 'Student Performance Report',
      description: 'Comprehensive student performance analysis with grades, attendance, and CO/PO attainment',
      category: 'Academic',
      parameters: ['department_id', 'class_id', 'semester_id', 'subject_id', 'date_range'],
      icon: Users
    },
    {
      id: 'co-po-attainment',
      name: 'CO/PO Attainment Report',
      description: 'Course and Program Outcomes attainment analysis across departments and subjects',
      category: 'Academic',
      parameters: ['department_id', 'subject_id', 'semester_id', 'co_id', 'po_id'],
      icon: Target
    },
    {
      id: 'exam-analysis',
      name: 'Exam Analysis Report',
      description: 'Detailed exam performance analysis with question-wise breakdown and statistics',
      category: 'Academic',
      parameters: ['exam_id', 'class_id', 'subject_id', 'semester_id'],
      icon: Award
    },
    {
      id: 'teacher-performance',
      name: 'Teacher Performance Report',
      description: 'Teacher effectiveness analysis based on student performance and feedback',
      category: 'Academic',
      parameters: ['teacher_id', 'department_id', 'subject_id', 'semester_id', 'date_range'],
      icon: BookOpen
    },
    {
      id: 'department-analytics',
      name: 'Department Analytics Report',
      description: 'Department-wise performance metrics and comparative analysis',
      category: 'Administrative',
      parameters: ['department_id', 'semester_id', 'academic_year'],
      icon: Building
    },
    {
      id: 'attendance-report',
      name: 'Attendance Report',
      description: 'Student attendance analysis and patterns across classes and subjects',
      category: 'Academic',
      parameters: ['class_id', 'subject_id', 'semester_id', 'date_range'],
      icon: Clock
    },
    {
      id: 'question-bank-analysis',
      name: 'Question Bank Analysis',
      description: 'Question bank usage statistics and question difficulty analysis',
      category: 'Academic',
      parameters: ['question_bank_id', 'subject_id', 'bloom_level', 'difficulty_level'],
      icon: FileText
    },
    {
      id: 'system-usage',
      name: 'System Usage Report',
      description: 'System usage statistics, user activity, and performance metrics',
      category: 'System',
      parameters: ['date_range', 'user_role', 'department_id'],
      icon: BarChart3
    }
  ]

  const categories = ['All', 'Academic', 'Administrative', 'System', 'Financial']

  useEffect(() => {
    loadData()
  }, [filterCategory])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.get('/api/reports')
      let reportsData = response || []

      // Apply filters
      if (filterCategory && filterCategory !== 'All') {
        reportsData = reportsData.filter((r: Report) => r.category === filterCategory)
      }
      if (searchTerm) {
        reportsData = reportsData.filter((r: Report) => 
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      setReports(reportsData)
    } catch (error) {
      console.error('Error loading reports:', error)
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFromTemplate = (template: ReportTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      type: template.id,
      category: template.category,
      parameters: {},
      is_public: false
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingReport) {
        await apiClient.put(`/api/reports/${editingReport.id}`, formData)
      } else {
        await apiClient.post('/api/reports', formData)
      }
      setShowForm(false)
      setEditingReport(null)
      setFormData({
        name: '',
        description: '',
        type: '',
        category: '',
        parameters: {},
        is_public: false
      })
      loadData()
    } catch (error) {
      console.error('Error saving report:', error)
      setError('Failed to save report')
    }
  }

  const handleEdit = (report: Report) => {
    setEditingReport(report)
    setFormData({
      name: report.name,
      description: report.description,
      type: report.type,
      category: report.category,
      parameters: report.parameters,
      is_public: report.is_public
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return

    try {
      await apiClient.delete(`/api/reports/${id}`)
      loadData()
    } catch (error) {
      console.error('Error deleting report:', error)
      setError('Failed to delete report')
    }
  }

  const handleGenerate = async (report: Report) => {
    try {
      setGeneratingReport(report.id)
      const response = await apiClient.post(`/api/reports/${report.id}/generate`)
      setReportData(response.data?.data || response.data)
      loadData() // Refresh to get updated file info
    } catch (error) {
      console.error('Error generating report:', error)
      setError('Failed to generate report')
    } finally {
      setGeneratingReport(null)
    }
  }

  const handleDownload = async (report: Report) => {
    try {
      const response = await apiClient.get(`/api/reports/${report.id}/download`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `${report.name}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading report:', error)
      setError('Failed to download report')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Generate and manage comprehensive reports</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={loadData}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Report Templates */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Report Templates</h3>
          <p className="text-sm text-gray-600">Choose from pre-built report templates</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTemplates.map((template) => {
              const IconComponent = template.icon
              return (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleCreateFromTemplate(template)}
                >
                  <div className="flex items-center mb-3">
                    <IconComponent className="h-6 w-6 text-blue-500 mr-2" />
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {template.category}
                    </span>
                    <Plus className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory || ''}
              onChange={(e) => setFilterCategory(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {categories.map((category) => (
                <option key={category} value={category === 'All' ? '' : category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reports..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadData}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Generated</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <tr key={report.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-blue-500 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{report.name}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">{report.description}</div>
                      <div className="text-xs text-gray-400">
                        By {report.created_by_name || 'Unknown'} • {new Date(report.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {report.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.last_generated ? new Date(report.last_generated).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.file_size ? formatFileSize(report.file_size) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleGenerate(report)}
                      disabled={generatingReport === report.id}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                      title="Generate Report"
                    >
                      {generatingReport === report.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      ) : (
                        <BarChart3 className="h-4 w-4" />
                      )}
                    </button>
                    {report.file_path && (
                      <button
                        onClick={() => handleDownload(report)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Download Report"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(report)}
                      className="text-yellow-600 hover:text-yellow-900"
                      title="Edit Report"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Report Data Display */}
      {reportData && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{reportData.title}</h3>
              <button
                onClick={() => setReportData(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Generated on {new Date(reportData.generated_at).toLocaleString()}
            </p>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(reportData.summary).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-600 capitalize">
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-3">Data</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(reportData.data[0] || {}).map((key) => (
                        <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.data.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {typeof value === 'number' ? value.toLocaleString() : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reportData.data.length > 10 && (
                  <div className="text-center py-4 text-sm text-gray-500">
                    Showing first 10 rows of {reportData.data.length} total rows
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingReport ? 'Edit Report' : 'Create New Report'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Report Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select Type</option>
                    {reportTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.filter(c => c !== 'All').map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">Public (visible to all users)</label>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingReport(null)
                    setFormData({
                      name: '',
                      description: '',
                      type: '',
                      category: '',
                      parameters: {},
                      is_public: false
                    })
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingReport ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}