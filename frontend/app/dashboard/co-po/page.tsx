'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2, Eye, Target, BookOpen, Building, Filter, Upload, Download, Zap, Brain, BarChart3, Lightbulb, Settings } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface PO {
  id: number
  name: string
  description: string
  department_id: number
  department_name?: string
  created_at: string
}

interface CO {
  id: number
  name: string
  description: string
  subject_id: number
  subject_name?: string
  created_at: string
}

interface COPOMapping {
  id: number
  co_id: number
  po_id: number
  strength: number
  co_name?: string
  po_name?: string
  subject_name?: string
  department_name?: string
  created_at: string
}

interface Department {
  id: number
  name: string
  code: string
}

interface Subject {
  id: number
  name: string
  code: string
  department_id: number
  department_name?: string
}

interface COPOAnalytics {
  co_id: number
  co_name: string
  po_id: number
  po_name: string
  mapping_strength: number
  attainment_percentage: number
  student_count: number
  average_score: number
  bloom_distribution: Record<string, number>
  difficulty_distribution: Record<string, number>
}

interface COPORecommendation {
  co_id: number
  po_id: number
  confidence_score: number
  reason: string
  suggested_strength: number
}

interface SmartCOCreate {
  name: string
  description: string
  subject_id: number
  department_id: number
  auto_generate_mappings: boolean
  suggested_pos?: number[]
}

interface SmartPOCreate {
  name: string
  description: string
  department_id: number
  auto_generate_mappings: boolean
  suggested_cos?: number[]
}

export default function COPOPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'pos' | 'cos' | 'mappings'>('pos')
  const [pos, setPos] = useState<PO[]>([])
  const [cos, setCos] = useState<CO[]>([])
  const [mappings, setMappings] = useState<COPOMapping[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  // Smart CO/PO features state
  const [showSmartCreate, setShowSmartCreate] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [analytics, setAnalytics] = useState<COPOAnalytics[]>([])
  const [recommendations, setRecommendations] = useState<COPORecommendation[]>([])
  const [smartFormData, setSmartFormData] = useState<SmartCOCreate | SmartPOCreate>({
    name: '',
    description: '',
    subject_id: 0,
    department_id: 0,
    auto_generate_mappings: true
  })

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [posData, cosData, mappingsData, deptData, subjData] = await Promise.all([
        apiClient.getPOs(),
        apiClient.getCOs(),
        apiClient.getCOPOMappings(),
        apiClient.getDepartments(),
        apiClient.getSubjects()
      ])
      setPos(Array.isArray(posData) ? posData : [])
      setCos(Array.isArray(cosData) ? cosData : [])
      setMappings(Array.isArray(mappingsData) ? mappingsData : [])
      setDepartments(Array.isArray(deptData) ? deptData : [])
      setSubjects(Array.isArray(subjData) ? subjData : [])
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    // Filter logic will be implemented based on active tab
  }

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const poData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      department_id: parseInt(formData.get('department_id') as string)
    }

    try {
      await apiClient.createPO(poData)
      toast.success('PO created successfully')
      setShowCreateDialog(false)
      loadInitialData()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to create PO')
    }
  }

  const handleCreateCO = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const coData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      subject_id: parseInt(formData.get('subject_id') as string)
    }

    try {
      await apiClient.createCO(coData)
      toast.success('CO created successfully')
      setShowCreateDialog(false)
      loadInitialData()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to create CO')
    }
  }

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const mappingData = {
      co_id: parseInt(formData.get('co_id') as string),
      po_id: parseInt(formData.get('po_id') as string),
      strength: parseInt(formData.get('strength') as string)
    }

    try {
      await apiClient.createCOPOMapping(mappingData)
      toast.success('CO-PO mapping created successfully')
      setShowCreateDialog(false)
      loadInitialData()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to create mapping')
    }
  }

  const handleDelete = async (id: number, type: 'po' | 'co' | 'mapping') => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      switch (type) {
        case 'po':
          await apiClient.deletePO(id)
          break
        case 'co':
          await apiClient.deleteCO(id)
          break
        case 'mapping':
          await apiClient.deleteCOPOMapping(id)
          break
      }
      toast.success('Item deleted successfully')
      loadInitialData()
    } catch (error: any) {
      toast.error(error.detail || 'Failed to delete item')
    }
  }

  const getStrengthColor = (strength: number) => {
    if (strength >= 3) return 'bg-green-100 text-green-800'
    if (strength === 2) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getStrengthLabel = (strength: number) => {
    switch (strength) {
      case 1: return 'Weak'
      case 2: return 'Moderate'
      case 3: return 'Strong'
      default: return 'Unknown'
    }
  }

  // Smart CO/PO creation functions
  const handleSmartCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (activeTab === 'cos') {
        await apiClient.createSmartCO(smartFormData)
        toast.success('Smart CO created successfully')
      } else if (activeTab === 'pos') {
        await apiClient.createSmartPO(smartFormData)
        toast.success('Smart PO created successfully')
      }
      setShowSmartCreate(false)
      setSmartFormData({
        name: '',
        description: '',
        subject_id: 0,
        department_id: 0,
        auto_generate_mappings: true
      })
      loadInitialData()
    } catch (error: any) {
      console.error('Error creating smart CO/PO:', error)
      toast.error('Failed to create smart CO/PO')
    }
  }

  const loadAnalytics = async () => {
    try {
      const data = await apiClient.getCOPOAnalytics({
        department_id: selectedDepartment || undefined
      })
      setAnalytics(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading analytics:', error)
      toast.error('Failed to load analytics')
    }
  }

  const loadRecommendations = async () => {
    try {
      const departmentId = selectedDepartment || departments[0]?.id
      if (departmentId) {
        const data = await apiClient.getCOPORecommendations(departmentId)
        setRecommendations(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error loading recommendations:', error)
      toast.error('Failed to load recommendations')
    }
  }

  const applyRecommendation = async (recommendation: COPORecommendation) => {
    try {
      await apiClient.createCOPOMapping({
        co_id: recommendation.co_id,
        po_id: recommendation.po_id,
        mapping_strength: recommendation.suggested_strength
      })
      toast.success('Mapping applied successfully')
      loadInitialData()
      loadRecommendations()
    } catch (error: any) {
      console.error('Error applying recommendation:', error)
      toast.error('Failed to apply recommendation')
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
          <h2 className="text-2xl font-bold text-gray-900">CO-PO Management</h2>
          <p className="text-gray-600">Smart management of Program Outcomes, Course Outcomes, and their mappings</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAnalytics(true)}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              loadRecommendations()
              setShowRecommendations(true)
            }}
            className="flex items-center gap-2"
          >
            <Lightbulb className="h-4 w-4" />
            AI Recommendations
          </Button>
          <Button
            onClick={() => setShowSmartCreate(true)}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Smart Create {activeTab === 'pos' ? 'PO' : activeTab === 'cos' ? 'CO' : 'Mapping'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Manual Create
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'pos'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Target className="h-4 w-4 inline mr-2" />
          Program Outcomes
        </button>
        <button
          onClick={() => setActiveTab('cos')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'cos'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="h-4 w-4 inline mr-2" />
          Course Outcomes
        </button>
        <button
          onClick={() => setActiveTab('mappings')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'mappings'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Filter className="h-4 w-4 inline mr-2" />
          CO-PO Mappings
        </button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {activeTab !== 'pos' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments && Array.isArray(departments) && departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeTab === 'cos' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Subjects</option>
                  {subjects && Array.isArray(subjects) && subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content based on active tab */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pos && Array.isArray(pos) && pos.map((po) => (
            <Card key={po.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{po.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{po.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(po.id, 'po')}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building className="h-4 w-4" />
                  <span>{po.department_name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'cos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cos && Array.isArray(cos) && cos.map((co) => (
            <Card key={co.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{co.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{co.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(co.id, 'co')}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen className="h-4 w-4" />
                  <span>{co.subject_name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'mappings' && (
        <Card>
          <CardHeader>
            <CardTitle>CO-PO Mappings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Course Outcome</th>
                    <th className="text-left py-3 px-4">Program Outcome</th>
                    <th className="text-left py-3 px-4">Subject</th>
                    <th className="text-left py-3 px-4">Strength</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings && Array.isArray(mappings) && mappings.map((mapping) => (
                    <tr key={mapping.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{mapping.co_name}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{mapping.po_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{mapping.subject_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStrengthColor(mapping.strength)}>
                          {getStrengthLabel(mapping.strength)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(mapping.id, 'mapping')}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Create {activeTab === 'pos' ? 'Program Outcome' : activeTab === 'cos' ? 'Course Outcome' : 'CO-PO Mapping'}
            </h3>
            <form onSubmit={activeTab === 'pos' ? handleCreatePO : activeTab === 'cos' ? handleCreateCO : handleCreateMapping}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <Input name="name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    required
                  />
                </div>
                {activeTab === 'pos' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      name="department_id"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Department</option>
                      {departments && Array.isArray(departments) && departments.map(dept => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {activeTab === 'cos' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <select
                      name="subject_id"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Subject</option>
                      {subjects && Array.isArray(subjects) && subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {activeTab === 'mappings' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Course Outcome</label>
                      <select
                        name="co_id"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select CO</option>
                        {cos && Array.isArray(cos) && cos.map(co => (
                          <option key={co.id} value={co.id}>
                            {co.name} - {co.subject_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Program Outcome</label>
                      <select
                        name="po_id"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select PO</option>
                        {pos && Array.isArray(pos) && pos.map(po => (
                          <option key={po.id} value={po.id}>
                            {po.name} - {po.department_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                      <select
                        name="strength"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1">Weak (1)</option>
                        <option value="2">Moderate (2)</option>
                        <option value="3">Strong (3)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Create
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart CO/PO Creation Modal */}
      {showSmartCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              Smart {activeTab === 'pos' ? 'PO' : activeTab === 'cos' ? 'CO' : 'Mapping'} Creation
            </h2>
            <form onSubmit={handleSmartCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={smartFormData.name}
                  onChange={(e) => setSmartFormData(prev => ({...prev, name: e.target.value}))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder={`e.g., ${activeTab === 'pos' ? 'PO1' : 'CO1'}`}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={smartFormData.description}
                  onChange={(e) => setSmartFormData(prev => ({...prev, description: e.target.value}))}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={4}
                  placeholder="Detailed description of the outcome..."
                  required
                />
              </div>

              {activeTab === 'cos' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <select
                    value={smartFormData.subject_id}
                    onChange={(e) => setSmartFormData(prev => ({...prev, subject_id: parseInt(e.target.value)}))}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value={0}>Select Subject</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={smartFormData.department_id}
                  onChange={(e) => setSmartFormData(prev => ({...prev, department_id: parseInt(e.target.value)}))}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value={0}>Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_generate"
                  checked={smartFormData.auto_generate_mappings}
                  onChange={(e) => setSmartFormData(prev => ({...prev, auto_generate_mappings: e.target.checked}))}
                  className="rounded"
                />
                <label htmlFor="auto_generate" className="text-sm font-medium">
                  Auto-generate smart mappings using AI
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Create Smart {activeTab === 'pos' ? 'PO' : activeTab === 'cos' ? 'CO' : 'Mapping'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSmartCreate(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">CO-PO Analytics</h2>
            <div className="mb-4">
              <Button onClick={loadAnalytics} className="mb-4">
                <BarChart3 className="h-4 w-4 mr-2" />
                Refresh Analytics
              </Button>
            </div>
            
            {analytics.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2">CO</th>
                      <th className="border border-gray-300 px-4 py-2">PO</th>
                      <th className="border border-gray-300 px-4 py-2">Strength</th>
                      <th className="border border-gray-300 px-4 py-2">Attainment %</th>
                      <th className="border border-gray-300 px-4 py-2">Students</th>
                      <th className="border border-gray-300 px-4 py-2">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.map((item, index) => (
                      <tr key={index}>
                        <td className="border border-gray-300 px-4 py-2">{item.co_name}</td>
                        <td className="border border-gray-300 px-4 py-2">{item.po_name}</td>
                        <td className="border border-gray-300 px-4 py-2">
                          <Badge className={getStrengthColor(item.mapping_strength)}>
                            {getStrengthLabel(item.mapping_strength)}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">{item.attainment_percentage.toFixed(1)}%</td>
                        <td className="border border-gray-300 px-4 py-2">{item.student_count}</td>
                        <td className="border border-gray-300 px-4 py-2">{item.average_score.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No analytics data available. Load analytics to see CO-PO performance metrics.
              </div>
            )}
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAnalytics(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendations Modal */}
      {showRecommendations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">AI-Powered CO-PO Mapping Recommendations</h2>
            <div className="mb-4">
              <Button onClick={loadRecommendations} className="mb-4">
                <Brain className="h-4 w-4 mr-2" />
                Refresh Recommendations
              </Button>
            </div>
            
            {recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">
                          CO{rec.co_id} → PO{rec.po_id}
                        </h3>
                        <p className="text-sm text-gray-600">{rec.reason}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-blue-100 text-blue-800">
                          {Math.round(rec.confidence_score * 100)}% confidence
                        </Badge>
                        <Badge className={getStrengthColor(rec.suggested_strength)}>
                          {getStrengthLabel(rec.suggested_strength)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => applyRecommendation(rec)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Apply Mapping
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Show details or edit
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recommendations available. AI will analyze existing COs and POs to suggest mappings.
              </div>
            )}
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowRecommendations(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}