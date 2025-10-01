'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  ClipboardList, 
  Plus, 
  Edit, 
  Eye, 
  Trash2, 
  Calculator,
  Settings,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Brain,
  Zap,
  BarChart3
} from 'lucide-react'

interface Question {
  id: number
  question_text: string
  question_type: string
  marks: number
  difficulty_level: string
  bloom_level: string
  is_optional: boolean
  is_sub_question: boolean
  parent_question_id?: number
  sub_questions?: Question[]
  co_weight: number
}

interface Exam {
  id: number
  title: string
  description: string
  exam_type: string
  subject_name: string
  class_name: string
  total_marks: number
  duration_minutes: number
  weightage: number
  calculation_rules?: any
  questions: Question[]
  created_at: string
  is_active: boolean
}

interface ExamResult {
  student_id: number
  student_name: string
  student_roll: string
  basic_percentage: number
  weighted_percentage: number
  final_percentage: number
  grade: string
  is_passed: boolean
  applied_rules: string[]
}

export default function ExamManagementPage() {
  const { user } = useAuth()
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [optionalQuestions, setOptionalQuestions] = useState<any[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Mock data
  const mockExams: Exam[] = [
    {
      id: 1,
      title: 'Midterm Exam - Programming Fundamentals',
      description: 'Comprehensive midterm examination',
      exam_type: 'internal',
      subject_name: 'Programming Fundamentals',
      class_name: 'BCA 2nd Year A',
      total_marks: 100,
      duration_minutes: 180,
      weightage: 1.0,
      calculation_rules: {
        optional_questions_rule: {
          rule_type: 'best_of',
          parameters: { count: 4 },
          description: 'Best of 4 optional questions'
        },
        section_weightage: {
          'Section A': 0.3,
          'Section B': 0.4,
          'Section C': 0.3
        },
        passing_criteria: { minimum_percentage: 40 },
        grade_calculation: {
          'A+': 90, 'A': 80, 'B+': 70, 'B': 60, 'C+': 50, 'C': 40, 'D': 30, 'F': 0
        }
      },
      questions: [
        {
          id: 1,
          question_text: 'Explain the concept of object-oriented programming',
          question_type: 'long_answer',
          marks: 10,
          difficulty_level: 'medium',
          bloom_level: 'understand',
          is_optional: false,
          is_sub_question: false,
          co_weight: 1.0
        },
        {
          id: 2,
          question_text: 'Write a program to find factorial of a number',
          question_type: 'long_answer',
          marks: 15,
          difficulty_level: 'hard',
          bloom_level: 'apply',
          is_optional: true,
          is_sub_question: false,
          co_weight: 1.0,
          sub_questions: [
            {
              id: 3,
              question_text: 'Implement using recursion',
              question_type: 'long_answer',
              marks: 8,
              difficulty_level: 'hard',
              bloom_level: 'apply',
              is_optional: false,
              is_sub_question: true,
              parent_question_id: 2,
              co_weight: 1.0
            },
            {
              id: 4,
              question_text: 'Implement using iteration',
              question_type: 'long_answer',
              marks: 7,
              difficulty_level: 'medium',
              bloom_level: 'apply',
              is_optional: false,
              is_sub_question: true,
              parent_question_id: 2,
              co_weight: 1.0
            }
          ]
        }
      ],
      created_at: '2024-01-15T10:00:00Z',
      is_active: true
    }
  ]

  const mockExamResults: ExamResult[] = [
    {
      student_id: 1,
      student_name: 'John Doe',
      student_roll: 'CS001',
      basic_percentage: 78.5,
      weighted_percentage: 78.5,
      final_percentage: 85.2,
      grade: 'B+',
      is_passed: true,
      applied_rules: ['Best of 4 optional questions applied', 'Section weightage applied']
    },
    {
      student_id: 2,
      student_name: 'Jane Smith',
      student_roll: 'CS002',
      basic_percentage: 92.3,
      weighted_percentage: 92.3,
      final_percentage: 95.1,
      grade: 'A+',
      is_passed: true,
      applied_rules: ['Best of 4 optional questions applied']
    }
  ]

  useEffect(() => {
    setExams(mockExams)
    setExamResults(mockExamResults)
  }, [])

  const handleCalculateResults = async (examId: number) => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      alert('Exam results calculated successfully!')
    } catch (error) {
      console.error('Error calculating results:', error)
      alert('Error calculating results')
    } finally {
      setLoading(false)
    }
  }

  const handleGetOptionalQuestions = async (examId: number) => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock optional questions data
      const mockOptionalQuestions = [
        {
          group_id: 1,
          parent_question: {
            id: 2,
            question_text: 'Write a program to find factorial of a number',
            marks: 15,
            difficulty_level: 'hard',
            bloom_level: 'apply'
          },
          sub_questions: [
            {
              id: 3,
              question_text: 'Implement using recursion',
              marks: 8,
              correct_answer: 'Recursive implementation'
            },
            {
              id: 4,
              question_text: 'Implement using iteration',
              marks: 7,
              correct_answer: 'Iterative implementation'
            }
          ],
          total_marks: 15,
          instructions: 'Answer any 1 questions from this group'
        }
      ]
      
      setOptionalQuestions(mockOptionalQuestions)
    } catch (error) {
      console.error('Error fetching optional questions:', error)
      alert('Error fetching optional questions')
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getBloomColor = (level: string) => {
    switch (level) {
      case 'remember':
        return 'bg-blue-100 text-blue-800'
      case 'understand':
        return 'bg-purple-100 text-purple-800'
      case 'apply':
        return 'bg-orange-100 text-orange-800'
      case 'analyze':
        return 'bg-pink-100 text-pink-800'
      case 'evaluate':
        return 'bg-indigo-100 text-indigo-800'
      case 'create':
        return 'bg-teal-100 text-teal-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-green-600'
      case 'B+':
      case 'B':
        return 'text-blue-600'
      case 'C+':
      case 'C':
        return 'text-yellow-600'
      case 'D':
        return 'text-orange-600'
      case 'F':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (!user || !['admin', 'hod', 'teacher'].includes(user.role)) {
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
          <h1 className="text-3xl font-bold tracking-tight">Exam Management</h1>
          <p className="text-muted-foreground">
            Advanced exam management with optional questions and weightage
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Exam
        </Button>
      </div>

      <Tabs defaultValue="exams" className="space-y-4">
        <TabsList>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="optional-questions">Optional Questions</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Exams Tab */}
        <TabsContent value="exams" className="space-y-4">
          <div className="grid gap-4">
            {exams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5" />
                        {exam.title}
                      </CardTitle>
                      <CardDescription>
                        {exam.subject_name} • {exam.class_name} • {exam.exam_type}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={exam.is_active ? 'default' : 'secondary'}>
                        {exam.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">
                        Weight: {exam.weightage}x
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-sm font-medium">Total Marks</Label>
                      <p className="text-2xl font-bold">{exam.total_marks}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Duration</Label>
                      <p className="text-2xl font-bold">{exam.duration_minutes}m</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Questions</Label>
                      <p className="text-2xl font-bold">{exam.questions.length}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Optional Questions</Label>
                      <p className="text-2xl font-bold">
                        {exam.questions.filter(q => q.is_optional).length}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedExam(exam)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGetOptionalQuestions(exam.id)}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Optional Questions
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCalculateResults(exam.id)}
                      disabled={loading}
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate Results
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Optional Questions Tab */}
        <TabsContent value="optional-questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Optional Questions
              </CardTitle>
              <CardDescription>
                Manage optional questions and sub-questions for exams
              </CardDescription>
            </CardHeader>
            <CardContent>
              {optionalQuestions.length > 0 ? (
                <div className="space-y-4">
                  {optionalQuestions.map((group, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader>
                        <CardTitle className="text-lg">Question Group {group.group_id}</CardTitle>
                        <CardDescription>{group.instructions}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Parent Question */}
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">Parent Question</h4>
                              <div className="flex gap-2">
                                <Badge className={getDifficultyColor(group.parent_question.difficulty_level)}>
                                  {group.parent_question.difficulty_level}
                                </Badge>
                                <Badge className={getBloomColor(group.parent_question.bloom_level)}>
                                  {group.parent_question.bloom_level}
                                </Badge>
                                <Badge variant="outline">{group.parent_question.marks} marks</Badge>
                              </div>
                            </div>
                            <p className="text-sm">{group.parent_question.question_text}</p>
                          </div>

                          {/* Sub Questions */}
                          <div className="space-y-2">
                            <h5 className="font-medium">Sub Questions:</h5>
                            {group.sub_questions.map((subQ: any, subIndex: number) => (
                              <div key={subIndex} className="p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">Sub Question {subIndex + 1}</span>
                                  <Badge variant="outline">{subQ.marks} marks</Badge>
                                </div>
                                <p className="text-sm">{subQ.question_text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No optional questions available</p>
                  <p className="text-sm text-gray-400">Select an exam to view optional questions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Exam Results
              </CardTitle>
              <CardDescription>
                View calculated exam results with weightage and rules applied
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Basic %</TableHead>
                    <TableHead>Weighted %</TableHead>
                    <TableHead>Final %</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rules Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examResults.map((result) => (
                    <TableRow key={result.student_id}>
                      <TableCell className="font-medium">{result.student_name}</TableCell>
                      <TableCell>{result.student_roll}</TableCell>
                      <TableCell>{result.basic_percentage.toFixed(1)}%</TableCell>
                      <TableCell>{result.weighted_percentage.toFixed(1)}%</TableCell>
                      <TableCell className="font-medium">{result.final_percentage.toFixed(1)}%</TableCell>
                      <TableCell>
                        <span className={`font-bold ${getGradeColor(result.grade)}`}>
                          {result.grade}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={result.is_passed ? 'default' : 'destructive'}>
                          {result.is_passed ? (
                            <><CheckCircle className="h-3 w-3 mr-1" />Passed</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" />Failed</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {result.applied_rules.map((rule, index) => (
                            <div key={index} className="text-xs text-blue-600">• {rule}</div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Exam Settings
              </CardTitle>
              <CardDescription>
                Configure default exam settings and calculation rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Default Weightage</Label>
                  <p className="text-sm text-gray-600 mb-2">Set default weightage for new exams</p>
                  <Input type="number" step="0.1" defaultValue="1.0" className="w-32" />
                </div>

                <div>
                  <Label className="text-base font-medium">Grade Calculation</Label>
                  <p className="text-sm text-gray-600 mb-2">Configure grade thresholds</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'].map((grade) => (
                      <div key={grade} className="flex items-center gap-2">
                        <Label className="w-8">{grade}</Label>
                        <Input type="number" placeholder="%" className="w-16" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">Passing Criteria</Label>
                  <p className="text-sm text-gray-600 mb-2">Minimum percentage required to pass</p>
                  <Input type="number" defaultValue="40" className="w-32" />
                </div>

                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
