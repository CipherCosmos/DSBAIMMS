'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Calendar, Users, BookOpen, UserCheck } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

interface Attendance {
  id: number
  student_id: number
  student_name?: string
  subject_id: number
  subject_name?: string
  class_id: number
  class_name?: string
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
  remarks?: string
  marked_by?: number
  marked_by_name?: string
  created_at: string
  updated_at?: string
}

interface AttendanceFormData {
  student_id: number
  subject_id: number
  class_id: number
  attendance_date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
  remarks: string
}

interface AttendanceManagerProps {
  departmentId?: number
  classId?: number
  subjectId?: number
}

export default function AttendanceManager({ departmentId, classId, subjectId }: AttendanceManagerProps) {
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null)
  const [formData, setFormData] = useState<AttendanceFormData>({
    student_id: 0,
    subject_id: 0,
    class_id: 0,
    attendance_date: '',
    status: 'PRESENT',
    remarks: ''
  })
  const [students, setStudents] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])

  useEffect(() => {
    fetchAttendanceRecords()
    fetchInitialData()
  }, [departmentId, classId, subjectId])

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (departmentId) params.department_id = departmentId
      if (classId) params.class_id = classId
      if (subjectId) params.subject_id = subjectId

      const data = await apiClient.getAttendanceRecords(params)
      setAttendanceRecords(data.data || [])
    } catch (error) {
      console.error('Failed to fetch attendance records:', error)
      toast.error('Failed to fetch attendance records')
    } finally {
      setLoading(false)
    }
  }

  const fetchInitialData = async () => {
    try {
      const [studentsData, subjectsData, classesData] = await Promise.all([
        apiClient.getUsers({ role: 'student' }),
        apiClient.getSubjects(),
        apiClient.getClasses()
      ])

      setStudents(studentsData?.data || [])
      setSubjects(subjectsData?.data || [])
      setClasses(classesData?.data || [])
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
    }
  }

  const handleCreateAttendance = async () => {
    try {
      await apiClient.createAttendanceRecord(formData)
      toast.success('Attendance record created successfully')
      setShowCreateModal(false)
      setFormData({
        student_id: 0,
        subject_id: 0,
        class_id: 0,
        attendance_date: '',
        status: 'PRESENT',
        remarks: ''
      })
      fetchAttendanceRecords()
    } catch (error) {
      console.error('Failed to create attendance record:', error)
      toast.error('Failed to create attendance record')
    }
  }

  const handleEditAttendance = async () => {
    if (!selectedAttendance) return

    try {
      await apiClient.updateAttendanceRecord(selectedAttendance.id, formData)
      toast.success('Attendance record updated successfully')
      setShowEditModal(false)
      setSelectedAttendance(null)
      fetchAttendanceRecords()
    } catch (error) {
      console.error('Failed to update attendance record:', error)
      toast.error('Failed to update attendance record')
    }
  }

  const handleDeleteAttendance = async (attendanceId: number) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return

    try {
      await apiClient.deleteAttendanceRecord(attendanceId)
      toast.success('Attendance record deleted successfully')
      fetchAttendanceRecords()
    } catch (error) {
      console.error('Failed to delete attendance record:', error)
      toast.error('Failed to delete attendance record')
    }
  }

  const openEditModal = (attendance: Attendance) => {
    setSelectedAttendance(attendance)
    setFormData({
      student_id: attendance.student_id,
      subject_id: attendance.subject_id,
      class_id: attendance.class_id,
      attendance_date: attendance.attendance_date,
      status: attendance.status,
      remarks: attendance.remarks || ''
    })
    setShowEditModal(true)
  }

  const filteredAttendance = attendanceRecords.filter(record =>
    record.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.class_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-green-100 text-green-800'
      case 'ABSENT':
        return 'bg-red-100 text-red-800'
      case 'LATE':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <UserCheck className="w-4 h-4 text-green-600" />
      case 'ABSENT':
        return <UserCheck className="w-4 h-4 text-red-600" />
      case 'LATE':
        return <UserCheck className="w-4 h-4 text-yellow-600" />
      default:
        return <UserCheck className="w-4 h-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Mark Attendance
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search attendance records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAttendance.map((record) => (
          <Card key={record.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{record.student_name}</CardTitle>
                  <p className="text-sm text-gray-500">{record.subject_name}</p>
                  <Badge className={`mt-1 ${getStatusColor(record.status)}`}>
                    {record.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(record)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteAttendance(record.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{formatDate(record.attendance_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-gray-400" />
                <span>{record.class_name}</span>
              </div>
              {record.remarks && (
                <div className="text-sm text-gray-600">
                  <strong>Remarks:</strong> {record.remarks}
                </div>
              )}
              {record.marked_by_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>Marked by: {record.marked_by_name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAttendance.length === 0 && !loading && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No attendance records found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search terms.' : 'Get started by marking attendance.'}
          </p>
        </div>
      )}

      {/* Create Attendance Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Mark Attendance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <Input
                  type="date"
                  value={formData.attendance_date}
                  onChange={(e) => setFormData({ ...formData, attendance_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'PRESENT' | 'ABSENT' | 'LATE' })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Remarks (Optional)</label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter remarks"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreateAttendance} className="flex-1">
                Mark Attendance
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Attendance Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Attendance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value={0}>Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <Input
                  type="date"
                  value={formData.attendance_date}
                  onChange={(e) => setFormData({ ...formData, attendance_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'PRESENT' | 'ABSENT' | 'LATE' })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">Late</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Remarks (Optional)</label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter remarks"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleEditAttendance} className="flex-1">
                Update Attendance
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
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
