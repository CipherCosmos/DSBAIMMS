'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'
import { 
  Target, Plus, Edit, Trash2, Save, X, Eye, BarChart3, 
  TrendingUp, Users, BookOpen, Award, RefreshCw, Download,
  Upload, FileText, CheckCircle, AlertCircle
} from 'lucide-react'

interface CO {
  id: number
  name: string
  description: string
  subject_id: number
  subject_name?: string
  department_id: number
  department_name?: string
  created_at: string
  updated_at?: string
}

interface PO {
  id: number
  name: string
  description: string
  department_id: number
  department_name?: string
  created_at: string
  updated_at?: string
}

interface COPOMapping {
  id: number
  co_id: number
  po_id: number
  mapping_strength: number
  justification?: string
  co_name?: string
  po_name?: string
  created_at: string
}

interface COAttainment {
  id: number
  co_id: number
  co_name: string
  semester_id: number
  class_id: number
  subject_id: number
  attainment_percentage: number
  target_percentage: number
  student_count: number
  average_score: number
  bloom_distribution: Record<string, number>
  difficulty_distribution: Record<string, number>
}

interface POAttainment {
  id: number
  po_id: number
  po_name: string
  semester_id: number
  class_id: number
  department_id: number
  attainment_percentage: number
  target_percentage: number
  student_count: number
  average_score: number
  co_contributions: Record<string, any>
}

export function COPOManagement() {
  const [activeTab, setActiveTab] = useState<'cos' | 'pos' | 'mappings' | 'attainment'>('cos')
  const [cos, setCos] = useState<CO[]>([])
  const [pos, setPos] = useState<PO[]>([])
  const [mappings, setMappings] = useState<COPOMapping[]>([])
  const [coAttainments, setCOAttainments] = useState<COAttainment[]>([])
  const [poAttainments, setPOAttainments] = useState<POAttainment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form states
  const [showCOForm, setShowCOForm] = useState(false)
  const [showPOForm, setShowPOForm] = useState(false)
  const [showMappingForm, setShowMappingForm] = useState(false)
  const [editingCO, setEditingCO] = useState<CO | null>(null)
  const [editingPO, setEditingPO] = useState<PO | null>(null)
  const [editingMapping, setEditingMapping] = useState<COPOMapping | null>(null)

  // Form data
  const [coForm, setCOForm] = useState({
    name: '',
    description: '',
    subject_id: 0,
    department_id: 0
  })
  const [poForm, setPOForm] = useState({
    name: '',
    description: '',
    department_id: 0
  })
  const [mappingForm, setMappingForm] = useState({
    co_id: 0,
    po_id: 0,
    mapping_strength: 1,
    justification: ''
  })

  // Filter states
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null)
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null)
  const [selectedClass, setSelectedClass] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab, selectedDepartment, selectedSemester, selectedClass])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      switch (activeTab) {
        case 'cos':
          const cosResponse = await apiClient.get('/api/cos')
          setCos(cosResponse.data)
          break
        case 'pos':
          const posResponse = await apiClient.get('/api/pos')
          setPos(posResponse.data)
          break
        case 'mappings':
          const mappingsResponse = await apiClient.get('/api/co-po-mappings')
          setMappings(mappingsResponse.data)
          break
        case 'attainment':
          if (selectedSemester && selectedClass) {
            const [coAttainmentResponse, poAttainmentResponse] = await Promise.all([
              apiClient.get(`/api/analytics/co-attainment?semester_id=${selectedSemester}&class_id=${selectedClass}`),
              apiClient.get(`/api/analytics/po-attainment?semester_id=${selectedSemester}&class_id=${selectedClass}&department_id=${selectedDepartment}`)
            ])
            setCOAttainments(coAttainmentResponse.data)
            setPOAttainments(poAttainmentResponse.data)
          }
          break
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleCOSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCO) {
        await apiClient.put(`/api/cos/${editingCO.id}`, coForm)
      } else {
        await apiClient.post('/api/cos', coForm)
      }
      setShowCOForm(false)
      setEditingCO(null)
      setCOForm({ name: '', description: '', subject_id: 0, department_id: 0 })
      loadData()
    } catch (error) {
      console.error('Error saving CO:', error)
      setError('Failed to save CO')
    }
  }

  const handlePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPO) {
        await apiClient.put(`/api/pos/${editingPO.id}`, poForm)
      } else {
        await apiClient.post('/api/pos', poForm)
      }
      setShowPOForm(false)
      setEditingPO(null)
      setPOForm({ name: '', description: '', department_id: 0 })
      loadData()
    } catch (error) {
      console.error('Error saving PO:', error)
      setError('Failed to save PO')
    }
  }

  const handleMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingMapping) {
        await apiClient.put(`/api/co-po-mappings/${editingMapping.id}`, mappingForm)
      } else {
        await apiClient.post('/api/co-po-mappings', mappingForm)
      }
      setShowMappingForm(false)
      setEditingMapping(null)
      setMappingForm({ co_id: 0, po_id: 0, mapping_strength: 1, justification: '' })
      loadData()
    } catch (error) {
      console.error('Error saving mapping:', error)
      setError('Failed to save mapping')
    }
  }

  const handleDelete = async (id: number, type: 'co' | 'po' | 'mapping') => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      switch (type) {
        case 'co':
          await apiClient.delete(`/api/cos/${id}`)
          break
        case 'po':
          await apiClient.delete(`/api/pos/${id}`)
          break
        case 'mapping':
          await apiClient.delete(`/api/co-po-mappings/${id}`)
          break
      }
      loadData()
    } catch (error) {
      console.error('Error deleting item:', error)
      setError('Failed to delete item')
    }
  }

  const handleEdit = (item: CO | PO | COPOMapping, type: 'co' | 'po' | 'mapping') => {
    switch (type) {
      case 'co':
        setEditingCO(item as CO)
        setCOForm({
          name: (item as any).name || '',
          description: (item as any).description || '',
          subject_id: (item as CO).subject_id,
          department_id: (item as CO).department_id
        })
        setShowCOForm(true)
        break
      case 'po':
        setEditingPO(item as PO)
        setPOForm({
          name: (item as any).name || '',
          description: (item as any).description || '',
          department_id: (item as PO).department_id
        })
        setShowPOForm(true)
        break
      case 'mapping':
        setEditingMapping(item as COPOMapping)
        setMappingForm({
          co_id: (item as COPOMapping).co_id,
          po_id: (item as COPOMapping).po_id,
          mapping_strength: (item as COPOMapping).mapping_strength,
          justification: (item as COPOMapping).justification || ''
        })
        setShowMappingForm(true)
        break
    }
  }

  const exportData = async () => {
    try {
      let data, filename
      switch (activeTab) {
        case 'cos':
          data = cos
          filename = 'course-outcomes.csv'
          break
        case 'pos':
          data = pos
          filename = 'program-outcomes.csv'
          break
        case 'mappings':
          data = mappings
          filename = 'co-po-mappings.csv'
          break
        case 'attainment':
          data = [...coAttainments, ...poAttainments]
          filename = 'co-po-attainment.csv'
          break
        default:
          return
      }

      const csvContent = convertToCSV(data)
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      setError('Failed to export data')
    }
  }

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]
          return typeof value === 'object' ? JSON.stringify(value) : value
        }).join(',')
      )
    ]
    return csvRows.join('\n')
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
          <h1 className="text-3xl font-bold text-gray-900">CO/PO Management</h1>
          <p className="text-gray-600">Manage Course Outcomes, Program Outcomes, and their mappings</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={loadData}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportData}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'cos', name: 'Course Outcomes', icon: Target },
            { id: 'pos', name: 'Program Outcomes', icon: Award },
            { id: 'mappings', name: 'CO-PO Mappings', icon: BarChart3 },
            { id: 'attainment', name: 'Attainment Analytics', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Course Outcomes Tab */}
      {activeTab === 'cos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Course Outcomes</h2>
            <button
              onClick={() => setShowCOForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add CO
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cos.map((co) => (
                  <tr key={co.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {co.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {co.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {co.subject_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {co.department_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(co, 'co')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(co.id, 'co')}
                          className="text-red-600 hover:text-red-900"
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
        </div>
      )}

      {/* Program Outcomes Tab */}
      {activeTab === 'pos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Program Outcomes</h2>
            <button
              onClick={() => setShowPOForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add PO
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pos.map((po) => (
                  <tr key={po.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {po.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {po.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {po.department_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(po, 'po')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(po.id, 'po')}
                          className="text-red-600 hover:text-red-900"
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
        </div>
      )}

      {/* CO-PO Mappings Tab */}
      {activeTab === 'mappings' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">CO-PO Mappings</h2>
            <button
              onClick={() => setShowMappingForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CO</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strength</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Justification</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {mapping.co_name || `CO${mapping.co_id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mapping.po_name || `PO${mapping.po_id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(mapping.mapping_strength / 3) * 100}%` }}
                          ></div>
                        </div>
                        <span>{mapping.mapping_strength}/3</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {mapping.justification || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(mapping, 'mapping')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapping.id, 'mapping')}
                          className="text-red-600 hover:text-red-900"
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
        </div>
      )}

      {/* Attainment Analytics Tab */}
      {activeTab === 'attainment' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Attainment Analytics</h2>
            <div className="flex space-x-2">
              <select
                value={selectedSemester || ''}
                onChange={(e) => setSelectedSemester(Number(e.target.value) || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Semester</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
                <option value="3">Semester 3</option>
                <option value="4">Semester 4</option>
              </select>
              <select
                value={selectedClass || ''}
                onChange={(e) => setSelectedClass(Number(e.target.value) || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Class</option>
                <option value="1">Class 1</option>
                <option value="2">Class 2</option>
                <option value="3">Class 3</option>
                <option value="4">Class 4</option>
              </select>
            </div>
          </div>

          {/* CO Attainment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CO Attainment</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attainment %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coAttainments.map((co) => (
                    <tr key={co.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {co.co_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                co.attainment_percentage >= co.target_percentage 
                                  ? 'bg-green-600' 
                                  : co.attainment_percentage >= co.target_percentage * 0.8
                                  ? 'bg-yellow-600'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${Math.min(co.attainment_percentage, 100)}%` }}
                            ></div>
                          </div>
                          <span>{co.attainment_percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {co.target_percentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {co.student_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {co.average_score.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          co.attainment_percentage >= co.target_percentage 
                            ? 'bg-green-100 text-green-800'
                            : co.attainment_percentage >= co.target_percentage * 0.8
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {co.attainment_percentage >= co.target_percentage ? 'Achieved' : 
                           co.attainment_percentage >= co.target_percentage * 0.8 ? 'Near Target' : 'Below Target'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PO Attainment */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">PO Attainment</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attainment %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {poAttainments.map((po) => (
                    <tr key={po.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {po.po_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                po.attainment_percentage >= po.target_percentage 
                                  ? 'bg-green-600' 
                                  : po.attainment_percentage >= po.target_percentage * 0.8
                                  ? 'bg-yellow-600'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${Math.min(po.attainment_percentage, 100)}%` }}
                            ></div>
                          </div>
                          <span>{po.attainment_percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {po.target_percentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {po.student_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {po.average_score.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          po.attainment_percentage >= po.target_percentage 
                            ? 'bg-green-100 text-green-800'
                            : po.attainment_percentage >= po.target_percentage * 0.8
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {po.attainment_percentage >= po.target_percentage ? 'Achieved' : 
                           po.attainment_percentage >= po.target_percentage * 0.8 ? 'Near Target' : 'Below Target'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CO Form Modal */}
      {showCOForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCO ? 'Edit CO' : 'Add New CO'}
            </h3>
            <form onSubmit={handleCOSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={coForm.name}
                  onChange={(e) => setCOForm({ ...coForm, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={coForm.description}
                  onChange={(e) => setCOForm({ ...coForm, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject ID</label>
                <input
                  type="number"
                  value={coForm.subject_id}
                  onChange={(e) => setCOForm({ ...coForm, subject_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Department ID</label>
                <input
                  type="number"
                  value={coForm.department_id}
                  onChange={(e) => setCOForm({ ...coForm, department_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCOForm(false)
                    setEditingCO(null)
                    setCOForm({ name: '', description: '', subject_id: 0, department_id: 0 })
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCO ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Form Modal */}
      {showPOForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingPO ? 'Edit PO' : 'Add New PO'}
            </h3>
            <form onSubmit={handlePOSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={poForm.name}
                  onChange={(e) => setPOForm({ ...poForm, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={poForm.description}
                  onChange={(e) => setPOForm({ ...poForm, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Department ID</label>
                <input
                  type="number"
                  value={poForm.department_id}
                  onChange={(e) => setPOForm({ ...poForm, department_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPOForm(false)
                    setEditingPO(null)
                    setPOForm({ name: '', description: '', department_id: 0 })
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingPO ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mapping Form Modal */}
      {showMappingForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingMapping ? 'Edit Mapping' : 'Add New CO-PO Mapping'}
            </h3>
            <form onSubmit={handleMappingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">CO ID</label>
                <input
                  type="number"
                  value={mappingForm.co_id}
                  onChange={(e) => setMappingForm({ ...mappingForm, co_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">PO ID</label>
                <input
                  type="number"
                  value={mappingForm.po_id}
                  onChange={(e) => setMappingForm({ ...mappingForm, po_id: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mapping Strength (1-3)</label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={mappingForm.mapping_strength}
                  onChange={(e) => setMappingForm({ ...mappingForm, mapping_strength: Number(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Justification</label>
                <textarea
                  value={mappingForm.justification}
                  onChange={(e) => setMappingForm({ ...mappingForm, justification: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowMappingForm(false)
                    setEditingMapping(null)
                    setMappingForm({ co_id: 0, po_id: 0, mapping_strength: 1, justification: '' })
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingMapping ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
