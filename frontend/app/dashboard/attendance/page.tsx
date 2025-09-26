'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { 
  Calendar, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Download,
  Upload,
  Filter,
  Search,
  BarChart3,
  TrendingUp,
  Eye
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Attendance {
  id: number
  student_id: number
  student_name: string
  subject_id: number
  subject_name: string
  class_id: number
  class_name: string
  attendance_date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  remarks?: string
  marked_by?: string
  created_at: string
  updated_at?: string
}

interface Subject {
  id: number
  name: string
  code: string
  class_id: number
  class_name?: string
}

interface Class {
  id: number
  name: string
  department_id: number
  department_name?: string
}

interface Student {
  id: number
  full_name: string
  student_id: string
  class_id: number
}

interface AttendanceStats {
  total_students: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  attendance_percentage: number
}

export default function AttendancePage() {
  const { user } = useAuth()
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showMarkForm, setShowMarkForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [attendanceRecords, setAttendanceRecords] = useState<{[key: number]: string}>({})
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [filterClass, setFilterClass] = useState<number | null>(null)
  const [filterSubject, setFilterSubject] = useState<number | null>(null)
  const [filterDate, setFilterDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [attendancesData, subjectsData, classesData] = await Promise.all([
        apiClient.get('/api/attendance'),
        apiClient.getSubjects(),
        apiClient.getClasses()
      ])

    setAttendances(attendancesData || [])
    setSubjects(subjectsData || [])
    setClasses(classesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadStudents = async (classId: number) => {
    try {
      const response = await apiClient.getClassStudents(classId)
      setStudents(response || [])
    } catch (error) {
      console.error('Error loading students:', error)
      toast.error('Failed to load students')
    }
  }

  const handleMarkAttendance = () => {
    if (!selectedDate || !selectedSubject || !selectedClass) {
      toast.error('Please select date, subject, and class')
      return
    }
    
    if (students.length === 0) {
      toast.error('No students found for the selected class')
      return
    }

    setShowMarkForm(true)
    loadStudents(Number(selectedClass))
  }

  const submitAttendance = async () => {
    try {
      const attendanceData = {
        subject_id: Number(selectedSubject),
        class_id: Number(selectedClass),
        attendance_date: selectedDate,
        records: Object.entries(attendanceRecords).map(([studentId, status]) => ({
          student_id: Number(studentId),
          status: status as 'present' | 'absent' | 'late' | 'excused'
        }))
      }

      await apiClient.post('/api/attendance/bulk', attendanceData)
      toast.success('Attendance marked successfully')
      setShowMarkForm(false)
      setAttendanceRecords({})
      loadData()
    } catch (error) {
      console.error('Error submitting attendance:', error)
      toast.error('Failed to mark attendance')
    }
  }

  const exportData = async () => {
    try {
      const params = new URLSearchParams()
      if (filterClass) params.append('class_id', filterClass.toString())
      if (filterSubject) params.append('subject_id', filterSubject.toString())
      if (filterDate) params.append('start_date', filterDate)

      const response = await apiClient.get(`/api/attendance/export/csv?${params}`, {
        responseType: 'blob'
      })

      const blob = new Blob([response], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'attendance_export.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export data')
    }
  }

  const filteredAttendances = attendances.filter(attendance => {
    if (filterClass && attendance.class_id !== filterClass) return false
    if (filterSubject && attendance.subject_id !== filterSubject) return false
    if (filterDate && !attendance.attendance_date.includes(filterDate)) return false
    if (searchTerm && !attendance.student_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'absent': return <XCircle className="h-4 w-4 text-red-500" />
      case 'late': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'excused': return <CheckCircle className="h-4 w-4 text-blue-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800'
      case 'absent': return 'bg-red-100 text-red-800'
      case 'late': return 'bg-yellow-100 text-yellow-800'
      case 'excused': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600">Track and manage student attendance</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportData}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button
            onClick={handleMarkAttendance}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Mark Attendance
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-semibold text-gray-900">{attendances.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-2xl font-semibold text-gray-900">
                {attendances.filter(a => a.status === 'present').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Absent Today</p>
              <p className="text-2xl font-semibold text-gray-900">
                {attendances.filter(a => a.status === 'absent').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {attendances.length > 0 ? Math.round((attendances.filter(a => a.status === 'present').length / attendances.length) * 100) : 0}%
              </p>
            </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={filterSubject || ''}
              onChange={(e) => setFilterSubject(Number(e.target.value) || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
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

      {/* Attendance Records Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Attendance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remarks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendances.map((attendance) => (
                <tr key={attendance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {attendance.student_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{attendance.subject_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{attendance.class_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(attendance.attendance_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(attendance.status)}`}>
                      {getStatusIcon(attendance.status)}
                      <span className="ml-1 capitalize">{attendance.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{attendance.remarks || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-indigo-600 hover:text-indigo-900">
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Attendance Modal */}
      {showMarkForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Mark Attendance</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subjects.find(s => s.id === Number(selectedSubject))?.name || ''}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <input
                    type="text"
                    value={classes.find(c => c.id === Number(selectedClass))?.name || ''}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{student.full_name}</div>
                      <div className="text-sm text-gray-500">{student.student_id}</div>
                    </div>
                    <select
                      value={attendanceRecords[student.id] || 'present'}
                      onChange={(e) => setAttendanceRecords(prev => ({
                        ...prev,
                        [student.id]: e.target.value
                      }))}
                      className="border border-gray-300 rounded px-3 py-1"
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowMarkForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAttendance}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Submit Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
