'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { 
  GraduationCap, 
  Users, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Filter,
  Search,
  BarChart3,
  TrendingUp,
  Eye,
  UserCheck,
  Calendar
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Student {
  id: number
  full_name: string
  student_id: string
  class_id: number
  class_name: string
  department_id: number
  department_name: string
  current_semester: number
  cgpa: number
  attendance_percentage: number
  credits_completed: number
  credits_required: number
  is_eligible: boolean
  promotion_status: 'pending' | 'approved' | 'rejected' | 'completed'
  remarks?: string
}

interface PromotionBatch {
  id: number
  name: string
  from_semester: number
  to_semester: number
  academic_year: string
  status: 'draft' | 'active' | 'completed'
  total_students: number
  eligible_students: number
  created_at: string
  created_by: string
}

interface Semester {
  id: number
  name: string
  semester_number: number
  academic_year: string
  is_active: boolean
}

interface Class {
  id: number
  name: string
  department_id: number
  department_name: string
}

interface PromotionCriteria {
  min_cgpa: number
  min_attendance: number
  min_credits_completed: number
  max_backlogs: number
}

export default function PromotionPage() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [promotionBatches, setPromotionBatches] = useState<PromotionBatch[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showPromotionForm, setShowPromotionForm] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [promotionCriteria, setPromotionCriteria] = useState<PromotionCriteria>({
    min_cgpa: 6.0,
    min_attendance: 75,
    min_credits_completed: 80,
    max_backlogs: 2
  })
  const [filterClass, setFilterClass] = useState<number | null>(null)
  const [filterSemester, setFilterSemester] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [studentsData, batchesData, semestersData, classesData] = await Promise.all([
        apiClient.get('/api/promotion/eligible-students'),
        apiClient.get('/api/promotion/batches'),
        apiClient.getSemesters(),
        apiClient.getClasses()
      ])

      setStudents(studentsData.data || [])
      setPromotionBatches(batchesData.data || [])
      setSemesters(semestersData.data || [])
      setClasses(classesData.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const checkEligibility = (student: Student) => {
    const criteria = promotionCriteria
    return (
      student.cgpa >= criteria.min_cgpa &&
      student.attendance_percentage >= criteria.min_attendance &&
      student.credits_completed >= criteria.min_credits_completed
    )
  }

  const handlePromoteStudents = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students to promote')
      return
    }

    if (!selectedSemester) {
      toast.error('Please select target semester')
      return
    }

    try {
      const promotionData = {
        student_ids: selectedStudents,
        target_semester_id: Number(selectedSemester),
        criteria: promotionCriteria,
        remarks: `Promoted from semester ${students.find(s => selectedStudents.includes(s.id))?.current_semester} to ${semesters.find(s => s.id === Number(selectedSemester))?.semester_number}`
      }

      await apiClient.post('/api/promotion/promote', promotionData)
      toast.success(`${selectedStudents.length} students promoted successfully`)
      setSelectedStudents([])
      setShowPromotionForm(false)
      loadData()
    } catch (error) {
      console.error('Error promoting students:', error)
      toast.error('Failed to promote students')
    }
  }

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const selectAllEligible = () => {
    const eligibleStudents = filteredStudents.filter(checkEligibility)
    setSelectedStudents(eligibleStudents.map(s => s.id))
  }

  const clearSelection = () => {
    setSelectedStudents([])
  }

  const filteredStudents = students.filter(student => {
    if (filterClass && student.class_id !== filterClass) return false
    if (filterSemester && student.current_semester !== filterSemester) return false
    if (filterStatus && student.promotion_status !== filterStatus) return false
    if (searchTerm && !student.full_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-blue-500" />
      default: return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getEligibilityColor = (student: Student) => {
    return checkEligibility(student) ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
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
          <h1 className="text-2xl font-bold text-gray-900">Student Promotion</h1>
          <p className="text-gray-600">Manage student academic progression and promotion</p>
        </div>
        <button
          onClick={() => setShowPromotionForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <GraduationCap className="h-4 w-4 mr-2" />
          Promote Students
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">{students.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Eligible</p>
              <p className="text-2xl font-semibold text-gray-900">
                {students.filter(checkEligibility).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">
                {students.filter(s => s.promotion_status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {students.filter(s => s.promotion_status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Promotion Criteria */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Promotion Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min CGPA</label>
            <input
              type="number"
              step="0.1"
              value={promotionCriteria.min_cgpa}
              onChange={(e) => setPromotionCriteria(prev => ({ ...prev, min_cgpa: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Attendance %</label>
            <input
              type="number"
              value={promotionCriteria.min_attendance}
              onChange={(e) => setPromotionCriteria(prev => ({ ...prev, min_attendance: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Credits</label>
            <input
              type="number"
              value={promotionCriteria.min_credits_completed}
              onChange={(e) => setPromotionCriteria(prev => ({ ...prev, min_credits_completed: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Backlogs</label>
            <input
              type="number"
              value={promotionCriteria.max_backlogs}
              onChange={(e) => setPromotionCriteria(prev => ({ ...prev, max_backlogs: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              value={filterClass || ''}
              onChange={(e) => setFilterClass(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              value={filterSemester || ''}
              onChange={(e) => setFilterSemester(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Semesters</option>
              {Array.from({length: 8}, (_, i) => i + 1).map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
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
                placeholder="Search students..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Selection Actions */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-3">
          <button
            onClick={selectAllEligible}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Select All Eligible
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
          >
            Clear Selection
          </button>
        </div>
        <div className="text-sm text-gray-600">
          {selectedStudents.length} students selected
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Student Promotion Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={(e) => e.target.checked ? selectAllEligible() : clearSelection()}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Semester
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CGPA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eligibility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className={`hover:bg-gray-50 ${getEligibilityColor(student)}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudentSelection(student.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                      <div className="text-sm text-gray-500">{student.student_id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{student.class_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">Semester {student.current_semester}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{student.cgpa.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{student.attendance_percentage}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {student.credits_completed}/{student.credits_required}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {checkEligibility(student) ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Eligible
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Eligible
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(student.promotion_status)}`}>
                      {getStatusIcon(student.promotion_status)}
                      <span className="ml-1 capitalize">{student.promotion_status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promotion Modal */}
      {showPromotionForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Promote Students</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Semester</label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select Semester</option>
                    {semesters.map((semester) => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name} - {semester.academic_year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selected Students</label>
                  <div className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-50">
                    {selectedStudents.length} students selected
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Promotion Notice</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>This action will promote the selected students to the next semester. This action cannot be undone.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPromotionForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePromoteStudents}
                  disabled={selectedStudents.length === 0 || !selectedSemester}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Promote Students
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
