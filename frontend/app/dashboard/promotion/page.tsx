'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  GraduationCap, 
  Users, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
  Upload,
  Filter,
  Search,
  Calendar,
  BarChart3
} from 'lucide-react'

interface Student {
  student_id: number
  student_name: string
  student_roll: string
  class_name: string
  department_name: string
  attendance_percentage: number
  pass_percentage: number
  total_subjects: number
  total_exams: number
  is_eligible: boolean
  reasons: string[]
}

interface PromotionData {
  current_semester: {
    id: number
    name: string
    department_name: string
  }
  target_semester: {
    id: number
    name: string
    department_name: string
  }
  criteria: {
    min_attendance_percentage: number
    min_pass_percentage: number
  }
  eligible_students: Student[]
  ineligible_students: Student[]
  summary: {
    total_students: number
    eligible_count: number
    ineligible_count: number
    promotion_rate: number
  }
}

export default function PromotionPage() {
  const { user } = useAuth()
  const [promotionData, setPromotionData] = useState<PromotionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [filters, setFilters] = useState({
    currentSemester: '',
    targetSemester: '',
    minAttendance: 75,
    minPassPercentage: 40
  })

  // Mock data for demonstration
  const mockPromotionData: PromotionData = {
    current_semester: {
      id: 1,
      name: 'Semester 2',
      department_name: 'Computer Science'
    },
    target_semester: {
      id: 2,
      name: 'Semester 3',
      department_name: 'Computer Science'
    },
    criteria: {
      min_attendance_percentage: 75,
      min_pass_percentage: 40
    },
    eligible_students: [
      {
        student_id: 1,
        student_name: 'John Doe',
        student_roll: 'CS001',
        class_name: 'BCA 2nd Year A',
        department_name: 'Computer Science',
        attendance_percentage: 85.5,
        pass_percentage: 78.2,
        total_subjects: 5,
        total_exams: 8,
        is_eligible: true,
        reasons: []
      },
      {
        student_id: 2,
        student_name: 'Jane Smith',
        student_roll: 'CS002',
        class_name: 'BCA 2nd Year A',
        department_name: 'Computer Science',
        attendance_percentage: 92.3,
        pass_percentage: 88.7,
        total_subjects: 5,
        total_exams: 8,
        is_eligible: true,
        reasons: []
      }
    ],
    ineligible_students: [
      {
        student_id: 3,
        student_name: 'Bob Johnson',
        student_roll: 'CS003',
        class_name: 'BCA 2nd Year A',
        department_name: 'Computer Science',
        attendance_percentage: 65.2,
        pass_percentage: 35.8,
        total_subjects: 5,
        total_exams: 8,
        is_eligible: false,
        reasons: [
          'Low attendance: 65.2% (required: 75%)',
          'Low performance: 35.8% (required: 40%)'
        ]
      }
    ],
    summary: {
      total_students: 3,
      eligible_count: 2,
      ineligible_count: 1,
      promotion_rate: 66.7
    }
  }

  useEffect(() => {
    // Load promotion data
    setPromotionData(mockPromotionData)
  }, [])

  const handleStudentSelection = (studentId: number, selected: boolean) => {
    if (selected) {
      setSelectedStudents(prev => [...prev, studentId])
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== studentId))
    }
  }

  const handleSelectAll = (students: Student[], selected: boolean) => {
    if (selected) {
      setSelectedStudents(students.map(s => s.student_id))
    } else {
      setSelectedStudents([])
    }
  }

  const handlePromoteStudents = async () => {
    if (selectedStudents.length === 0) return
    
    setLoading(true)
    try {
      // API call to promote students
      console.log('Promoting students:', selectedStudents)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Refresh data
      setSelectedStudents([])
      alert('Students promoted successfully!')
    } catch (error) {
      console.error('Error promoting students:', error)
      alert('Error promoting students')
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = () => {
    // Export promotion data
    console.log('Exporting promotion data')
  }

  if (!user || !['admin', 'hod'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Promotion</h1>
          <p className="text-muted-foreground">
            Manage student promotion between semesters
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button 
            onClick={handlePromoteStudents}
            disabled={selectedStudents.length === 0 || loading}
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            {loading ? 'Promoting...' : `Promote ${selectedStudents.length} Students`}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Promotion Criteria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="currentSemester">Current Semester</Label>
              <Select value={filters.currentSemester} onValueChange={(value) => setFilters(prev => ({ ...prev, currentSemester: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semester 2</SelectItem>
                  <SelectItem value="2">Semester 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="targetSemester">Target Semester</Label>
              <Select value={filters.targetSemester} onValueChange={(value) => setFilters(prev => ({ ...prev, targetSemester: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semester 3</SelectItem>
                  <SelectItem value="2">Semester 5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="minAttendance">Min Attendance (%)</Label>
              <Input
                id="minAttendance"
                type="number"
                value={filters.minAttendance}
                onChange={(e) => setFilters(prev => ({ ...prev, minAttendance: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="minPassPercentage">Min Pass %</Label>
              <Input
                id="minPassPercentage"
                type="number"
                value={filters.minPassPercentage}
                onChange={(e) => setFilters(prev => ({ ...prev, minPassPercentage: Number(e.target.value) }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {promotionData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{promotionData.summary.total_students}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eligible</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{promotionData.summary.eligible_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ineligible</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{promotionData.summary.ineligible_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promotion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{promotionData.summary.promotion_rate.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student Lists */}
      <Tabs defaultValue="eligible" className="space-y-4">
        <TabsList>
          <TabsTrigger value="eligible">
            Eligible Students ({promotionData?.summary.eligible_count || 0})
          </TabsTrigger>
          <TabsTrigger value="ineligible">
            Ineligible Students ({promotionData?.summary.ineligible_count || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eligible" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Eligible for Promotion</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAll(promotionData?.eligible_students || [], true)}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedStudents([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotionData?.eligible_students.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.student_id)}
                          onChange={(e) => handleStudentSelection(student.student_id, e.target.checked)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{student.student_name}</TableCell>
                      <TableCell>{student.student_roll}</TableCell>
                      <TableCell>{student.class_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.attendance_percentage} className="w-20" />
                          <span className="text-sm">{student.attendance_percentage.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.pass_percentage} className="w-20" />
                          <span className="text-sm">{student.pass_percentage.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Eligible
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ineligible" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Not Eligible for Promotion</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Reasons</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotionData?.ineligible_students.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell className="font-medium">{student.student_name}</TableCell>
                      <TableCell>{student.student_roll}</TableCell>
                      <TableCell>{student.class_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.attendance_percentage} className="w-20" />
                          <span className="text-sm">{student.attendance_percentage.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.pass_percentage} className="w-20" />
                          <span className="text-sm">{student.pass_percentage.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {student.reasons.map((reason, index) => (
                            <div key={index} className="text-xs text-red-600">{reason}</div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Eligible
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
