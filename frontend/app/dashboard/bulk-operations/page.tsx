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
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  Download, 
  FileText, 
  Users, 
  Building, 
  BookOpen, 
  ClipboardList,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Database,
  Settings
} from 'lucide-react'

interface Template {
  headers: string[]
  required_fields: string[]
  description?: string
  role_options?: string[]
  department_options?: Array<{id: number, name: string}>
  class_options?: Array<{id: number, name: string}>
  subject_options?: Array<{id: number, name: string}>
  exam_type_options?: string[]
}

interface BulkOperation {
  id: string
  type: 'import' | 'export'
  entity_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  created_at: string
  file_name?: string
  records_processed?: number
  records_total?: number
  errors?: string[]
}

export default function BulkOperationsPage() {
  const { user } = useAuth()
  const [selectedEntity, setSelectedEntity] = useState('')
  const [templates, setTemplates] = useState<Record<string, Template>>({})
  const [operations, setOperations] = useState<BulkOperation[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // Mock templates data
  const mockTemplates: Record<string, Template> = {
    users: {
      headers: ['username', 'email', 'full_name', 'first_name', 'last_name', 'role', 'department_id', 'class_id', 'student_id', 'employee_id', 'phone', 'address'],
      required_fields: ['username', 'email', 'role'],
      description: 'User management template',
      role_options: ['admin', 'hod', 'teacher', 'student'],
      department_options: [
        { id: 1, name: 'Computer Science' },
        { id: 2, name: 'Mathematics' }
      ],
      class_options: [
        { id: 1, name: 'BCA 1st Year A' },
        { id: 2, name: 'BCA 2nd Year A' }
      ]
    },
    departments: {
      headers: ['name', 'code', 'description', 'duration_years', 'academic_year', 'semester_count'],
      required_fields: ['name', 'code'],
      description: 'Department management template'
    },
    subjects: {
      headers: ['name', 'code', 'description', 'credits', 'class_id', 'department_id'],
      required_fields: ['name', 'code', 'class_id'],
      description: 'Subject management template',
      class_options: [
        { id: 1, name: 'BCA 1st Year A' },
        { id: 2, name: 'BCA 2nd Year A' }
      ],
      department_options: [
        { id: 1, name: 'Computer Science' },
        { id: 2, name: 'Mathematics' }
      ]
    },
    exams: {
      headers: ['title', 'description', 'exam_type', 'subject_id', 'class_id', 'total_marks', 'duration_minutes', 'start_time', 'end_time'],
      required_fields: ['title', 'subject_id', 'class_id', 'total_marks'],
      description: 'Exam management template',
      exam_type_options: ['internal', 'external', 'assignment', 'quiz', 'project'],
      subject_options: [
        { id: 1, name: 'Programming Fundamentals' },
        { id: 2, name: 'Data Structures' }
      ],
      class_options: [
        { id: 1, name: 'BCA 1st Year A' },
        { id: 2, name: 'BCA 2nd Year A' }
      ]
    }
  }

  // Mock operations data
  const mockOperations: BulkOperation[] = [
    {
      id: '1',
      type: 'import',
      entity_type: 'users',
      status: 'completed',
      progress: 100,
      created_at: '2024-01-15T10:30:00Z',
      file_name: 'users_batch_1.csv',
      records_processed: 50,
      records_total: 50
    },
    {
      id: '2',
      type: 'export',
      entity_type: 'departments',
      status: 'processing',
      progress: 75,
      created_at: '2024-01-15T11:00:00Z',
      records_processed: 15,
      records_total: 20
    },
    {
      id: '3',
      type: 'import',
      entity_type: 'subjects',
      status: 'failed',
      progress: 0,
      created_at: '2024-01-15T11:30:00Z',
      file_name: 'subjects_batch_1.csv',
      errors: ['Invalid class_id: 999', 'Missing required field: name']
    }
  ]

  useEffect(() => {
    setTemplates(mockTemplates)
    setOperations(mockOperations)
  }, [])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadFile(file)
    }
  }

  const handleImport = async () => {
    if (!uploadFile || !selectedEntity) return

    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const newOperation: BulkOperation = {
        id: Date.now().toString(),
        type: 'import',
        entity_type: selectedEntity,
        status: 'processing',
        progress: 0,
        created_at: new Date().toISOString(),
        file_name: uploadFile.name
      }
      
      setOperations(prev => [newOperation, ...prev])
      setUploadFile(null)
      alert('Import started successfully!')
    } catch (error) {
      console.error('Error importing file:', error)
      alert('Error importing file')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (entityType: string) => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const newOperation: BulkOperation = {
        id: Date.now().toString(),
        type: 'export',
        entity_type: entityType,
        status: 'processing',
        progress: 0,
        created_at: new Date().toISOString()
      }
      
      setOperations(prev => [newOperation, ...prev])
      alert('Export started successfully!')
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Error exporting data')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = (entityType: string) => {
    const template = templates[entityType]
    if (!template) return

    const csvContent = template.headers.join(',') + '\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entityType}_template.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      case 'processing':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-yellow-600 bg-yellow-100'
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Bulk Operations</h1>
          <p className="text-muted-foreground">
            Import and export data in bulk for efficient management
          </p>
        </div>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">Import Data</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="operations">Operations History</TabsTrigger>
        </TabsList>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Data
              </CardTitle>
              <CardDescription>
                Upload CSV or Excel files to import data into the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="entityType">Entity Type</Label>
                  <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="departments">Departments</SelectItem>
                      <SelectItem value="subjects">Subjects</SelectItem>
                      <SelectItem value="exams">Exams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="file">File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              {selectedEntity && templates[selectedEntity] && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Template Information</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate(selectedEntity)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <div>
                        <strong>Required Fields:</strong> {templates[selectedEntity].required_fields.join(', ')}
                      </div>
                      <div>
                        <strong>Headers:</strong> {templates[selectedEntity].headers.join(', ')}
                      </div>
                      {templates[selectedEntity].description && (
                        <div>
                          <strong>Description:</strong> {templates[selectedEntity].description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!uploadFile || !selectedEntity || loading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'Importing...' : 'Start Import'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Export data from the system in various formats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleExport('users')}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-8 w-8 text-blue-600" />
                      <div>
                        <h3 className="font-semibold">Users</h3>
                        <p className="text-sm text-gray-500">Export user data</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleExport('departments')}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Building className="h-8 w-8 text-green-600" />
                      <div>
                        <h3 className="font-semibold">Departments</h3>
                        <p className="text-sm text-gray-500">Export department data</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleExport('subjects')}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-8 w-8 text-purple-600" />
                      <div>
                        <h3 className="font-semibold">Subjects</h3>
                        <p className="text-sm text-gray-500">Export subject data</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleExport('exams')}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <ClipboardList className="h-8 w-8 text-orange-600" />
                      <div>
                        <h3 className="font-semibold">Exams</h3>
                        <p className="text-sm text-gray-500">Export exam data</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operations History Tab */}
        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Operations History
              </CardTitle>
              <CardDescription>
                Track the status of your bulk operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {operations.map((operation) => (
                  <div key={operation.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {operation.type === 'import' ? (
                          <Upload className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Download className="h-4 w-4 text-green-600" />
                        )}
                        <span className="font-medium capitalize">{operation.entity_type}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(operation.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(operation.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(operation.status)}`}>
                          {operation.status}
                        </span>
                      </div>
                    </div>

                    {operation.file_name && (
                      <div className="text-sm text-gray-600 mb-2">
                        File: {operation.file_name}
                      </div>
                    )}

                    {operation.status === 'processing' && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{operation.progress}%</span>
                        </div>
                        <Progress value={operation.progress} className="w-full" />
                        {operation.records_processed && operation.records_total && (
                          <div className="text-sm text-gray-600">
                            Processed {operation.records_processed} of {operation.records_total} records
                          </div>
                        )}
                      </div>
                    )}

                    {operation.status === 'completed' && operation.records_processed && (
                      <div className="text-sm text-green-600">
                        Successfully processed {operation.records_processed} records
                      </div>
                    )}

                    {operation.status === 'failed' && operation.errors && (
                      <div className="space-y-1">
                        <div className="text-sm text-red-600 font-medium">Errors:</div>
                        {operation.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-600">• {error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
