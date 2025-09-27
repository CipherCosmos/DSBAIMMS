'use client'

import React, { useState, useEffect } from 'react'
import { ArrowRight, Search, Users, GraduationCap, Calendar, BookOpen, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

interface Student {
  id: number
  name: string
  roll_number: string
  email: string
  current_semester_id: number
  current_semester_name?: string
  class_id?: number
  class_name?: string
  department_id: number
  department_name?: string
  cgpa?: number
  attendance_percentage?: number
  is_eligible_for_promotion: boolean
  promotion_issues?: string[]
}

interface PromotionBatch {
  id: number
  from_semester_id: number
  from_semester_name?: string
  to_semester_id: number
  to_semester_name?: string
  department_id: number
  department_name?: string
  student_count: number
  promoted_count: number
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  created_at: string
  updated_at?: string
}

interface PromotionManagerProps {
  departmentId?: number
}

export default function PromotionManager({ departmentId }: PromotionManagerProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [promotionBatches, setPromotionBatches] = useState<PromotionBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [showPromotionModal, setShowPromotionModal] = useState(false)
  const [promotionData, setPromotionData] = useState({
    from_semester_id: 0,
    to_semester_id: 0,
    department_id: 0
  })
  const [semesters, setSemesters] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  useEffect(() => {
    fetchStudents()
    fetchPromotionBatches()
    fetchInitialData()
  }, [departmentId])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (departmentId) params.department_id = departmentId

      const data = await apiClient.get(`/api/students/promotion`, { params })
      setStudents(data.data || [])
    } catch (error) {
      console.error('Failed to fetch students:', error)
      toast.error('Failed to fetch students')
    } finally {
      setLoading(false)
    }
  }

  const fetchPromotionBatches = async () => {
    try {
      const params: any = {}
      if (departmentId) params.department_id = departmentId

      const data = await apiClient.get(`/api/promotion/batches`, { params })
      setPromotionBatches(data.data || [])
    } catch (error) {
      console.error('Failed to fetch promotion batches:', error)
      toast.error('Failed to fetch promotion batches')
    }
  }

  const fetchInitialData = async () => {
    try {
      const [semestersData, departmentsData] = await Promise.all([
        apiClient.getSemesters(),
        apiClient.getDepartments()
      ])

      setSemesters(semestersData.data || [])
      setDepartments(departmentsData.data || [])
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
    }
  }

  const handleStudentSelection = (studentId: number) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleSelectAll = () => {
    const eligibleStudents = filteredStudents.filter(s => s.is_eligible_for_promotion)
    if (selectedStudents.length === eligibleStudents.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(eligibleStudents.map(s => s.id))
    }
  }

  const handlePromoteStudents = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students to promote')
      return
    }

    try {
      await apiClient.promoteStudents(promotionData.from_semester_id, promotionData.to_semester_id)
        // student_ids: selectedStudents,
        // from_semester_id: promotionData.from_semester_id,
        // to_semester_id: promotionData.to_semester_id,
        // department_id: promotionData.department_id
      // })
      toast.success(`Successfully promoted ${selectedStudents.length} students`)
      setSelectedStudents([])
      setShowPromotionModal(false)
      fetchStudents()
      fetchPromotionBatches()
    } catch (error) {
      console.error('Failed to promote students:', error)
      toast.error('Failed to promote students')
    }
  }

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.current_semester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const eligibleStudents = filteredStudents.filter(s => s.is_eligible_for_promotion)
  const ineligibleStudents = filteredStudents.filter(s => !s.is_eligible_for_promotion)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getEligibilityColor = (isEligible: boolean) => {
    return isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Student Promotion Management</h1>
        <Button 
          onClick={() => setShowPromotionModal(true)}
          disabled={selectedStudents.length === 0}
          className="flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          Promote Selected ({selectedStudents.length})
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Promotion Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold">{filteredStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Eligible</p>
                <p className="text-2xl font-bold">{eligibleStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Not Eligible</p>
                <p className="text-2xl font-bold">{ineligibleStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Selected</p>
                <p className="text-2xl font-bold">{selectedStudents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promotion Batches */}
      {promotionBatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Promotion Batches</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promotionBatches.map((batch) => (
              <Card key={batch.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      {batch.from_semester_name} → {batch.to_semester_name}
                    </CardTitle>
                    <Badge className={getStatusColor(batch.status)}>
                      {batch.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                      <span>{batch.department_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{batch.promoted_count}/{batch.student_count} students</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Students List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Students</h2>
          <Button variant="outline" onClick={handleSelectAll}>
            {selectedStudents.length === eligibleStudents.length ? 'Deselect All' : 'Select All Eligible'}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card 
              key={student.id} 
              className={`hover:shadow-lg transition-shadow ${
                selectedStudents.includes(student.id) ? 'ring-2 ring-blue-500' : ''
              } ${!student.is_eligible_for_promotion ? 'opacity-75' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => handleStudentSelection(student.id)}
                      disabled={!student.is_eligible_for_promotion}
                      className="rounded"
                    />
                    <div>
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <p className="text-sm text-gray-500">{student.roll_number}</p>
                    </div>
                  </div>
                  <Badge className={getEligibilityColor(student.is_eligible_for_promotion)}>
                    {student.is_eligible_for_promotion ? 'Eligible' : 'Not Eligible'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{student.current_semester_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  <span>{student.department_name}</span>
                </div>
                {student.class_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-gray-400" />
                    <span>{student.class_name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">CGPA:</span>
                    <span className="ml-1 font-medium">{student.cgpa?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Attendance:</span>
                    <span className="ml-1 font-medium">{student.attendance_percentage?.toFixed(1) || 'N/A'}%</span>
                  </div>
                </div>
                {student.promotion_issues && student.promotion_issues.length > 0 && (
                  <div className="text-sm">
                    <p className="text-red-600 font-medium">Issues:</p>
                    <ul className="text-red-600 text-xs list-disc list-inside">
                      {student.promotion_issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {filteredStudents.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'No students available for promotion.'}
          </p>
        </div>
      )}

      {/* Promotion Modal */}
      {showPromotionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Promote Students</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Semester</label>
                <select
                  value={promotionData.from_semester_id}
                  onChange={(e) => setPromotionData({ ...promotionData, from_semester_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select From Semester</option>
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To Semester</label>
                <select
                  value={promotionData.to_semester_id}
                  onChange={(e) => setPromotionData({ ...promotionData, to_semester_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select To Semester</option>
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={promotionData.department_id}
                  onChange={(e) => setPromotionData({ ...promotionData, department_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Selected Students:</strong> {selectedStudents.length}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handlePromoteStudents} className="flex-1">
                Promote Students
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPromotionModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
