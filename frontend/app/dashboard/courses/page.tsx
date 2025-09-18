'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, BookOpen, Calendar, Clock, Users, BarChart3, Download, Eye, Filter } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Subject {
  id: number
  name: string
  code: string
  credits: number
  department_name: string
  teacher_name: string
  description: string
  semester: number
  academic_year: string
}

interface Exam {
  id: number
  title: string
  exam_type: string
  total_marks: number
  duration_minutes: number
  exam_date: string
  status: string
  subject_name: string
}

interface Mark {
  id: number
  exam_id: number
  marks_obtained: number
  max_marks: number
  exam_title: string
  exam_type: string
  exam_date: string
  subject_name: string
}

interface Attendance {
  id: number
  subject_id: number
  date: string
  status: 'present' | 'absent' | 'late'
  subject_name: string
}

export default function CoursesPage() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [activeTab, setActiveTab] = useState<'subjects' | 'exams' | 'marks' | 'attendance'>('subjects')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [subjectsData, examsData, marksData, attendanceData] = await Promise.all([
        apiClient.getSubjects({ student_id: user?.id }),
        apiClient.getExams({ student_id: user?.id }),
        apiClient.getMarks({ student_id: user?.id }),
        // Mock attendance data - would come from backend
        Promise.resolve([])
      ])
      // Ensure data is an array
      setSubjects(Array.isArray(subjectsData) ? subjectsData : [])
      setExams(Array.isArray(examsData) ? examsData : [])
      setMarks(Array.isArray(marksData) ? marksData : [])
      setAttendance(Array.isArray(attendanceData) ? attendanceData : [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load course data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    // Filter logic based on active tab
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800'
      case 'ongoing':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 70) return 'text-yellow-600'
    if (percentage >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return 'A+'
    if (percentage >= 80) return 'A'
    if (percentage >= 70) return 'B+'
    if (percentage >= 60) return 'B'
    if (percentage >= 50) return 'C+'
    if (percentage >= 40) return 'C'
    return 'F'
  }

  const calculateOverallPerformance = () => {
    if (marks.length === 0) return { average: 0, totalExams: 0, passedExams: 0 }
    
    const totalMarks = marks.reduce((sum, mark) => sum + mark.marks_obtained, 0)
    const maxMarks = marks.reduce((sum, mark) => sum + mark.max_marks, 0)
    const average = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0
    const passedExams = marks.filter(mark => (mark.marks_obtained / mark.max_marks) * 100 >= 40).length
    
    return {
      average: Math.round(average),
      totalExams: marks.length,
      passedExams
    }
  }

  const performance = calculateOverallPerformance()

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
          <h2 className="text-2xl font-bold text-gray-900">My Courses</h2>
          <p className="text-gray-600">View your enrolled subjects, exams, and performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Enrolled Subjects</p>
                <p className="text-2xl font-semibold">{subjects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Overall Average</p>
                <p className={`text-2xl font-semibold ${getGradeColor(performance.average)}`}>
                  {performance.average}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Exams Taken</p>
                <p className="text-2xl font-semibold">{performance.totalExams}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Passed Exams</p>
                <p className="text-2xl font-semibold">{performance.passedExams}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'subjects'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="h-4 w-4 inline mr-2" />
          Subjects
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'exams'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="h-4 w-4 inline mr-2" />
          Exams
        </button>
        <button
          onClick={() => setActiveTab('marks')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'marks'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Marks
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'attendance'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Attendance
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
            {activeTab === 'subjects' && (
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
      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects && Array.isArray(subjects) && subjects.map((subject) => (
            <Card key={subject.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{subject.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{subject.code}</p>
                  </div>
                  <Badge variant="outline">{subject.credits} Credits</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">{subject.description}</p>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    <span>{subject.department_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{subject.teacher_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Semester {subject.semester} - {subject.academic_year}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'exams' && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming & Recent Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exams && Array.isArray(exams) && exams.map((exam) => (
                <div key={exam.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{exam.title}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span>{exam.subject_name}</span>
                        <span>{exam.exam_type}</span>
                        <span>{exam.total_marks} marks</span>
                        <span>{exam.duration_minutes} min</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(exam.status)}>
                      {exam.status}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {new Date(exam.exam_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'marks' && (
        <Card>
          <CardHeader>
            <CardTitle>Exam Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Subject</th>
                    <th className="text-left py-3 px-4">Exam</th>
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Marks</th>
                    <th className="text-left py-3 px-4">Percentage</th>
                    <th className="text-left py-3 px-4">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {marks && Array.isArray(marks) && marks.map((mark) => {
                    const percentage = Math.round((mark.marks_obtained / mark.max_marks) * 100)
                    return (
                      <tr key={mark.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{mark.subject_name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{mark.exam_title}</div>
                          <div className="text-sm text-gray-600">{mark.exam_type}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            {new Date(mark.exam_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">
                            {mark.marks_obtained} / {mark.max_marks}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`font-medium ${getGradeColor(percentage)}`}>
                            {percentage}%
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={getGradeColor(percentage)}>
                            {getGrade(percentage)}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'attendance' && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Record</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Attendance tracking coming soon</h3>
              <p className="text-gray-600">Attendance records will be available here once implemented.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {subjects && Array.isArray(subjects) && subjects.length === 0 && activeTab === 'subjects' && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No subjects enrolled</h3>
          <p className="text-gray-600">You are not enrolled in any subjects yet.</p>
        </div>
      )}
    </div>
  )
}
