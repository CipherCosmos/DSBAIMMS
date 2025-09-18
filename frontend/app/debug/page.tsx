'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api'

export default function DebugPage() {
  const [departments, setDepartments] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const testAPIs = async () => {
    setLoading(true)
    setError('')
    
    try {
      console.log('Testing APIs...')
      
      // Test departments
      console.log('Testing departments...')
      const deptResponse = await apiClient.getDepartments()
      console.log('Departments response:', deptResponse)
      setDepartments(Array.isArray(deptResponse) ? deptResponse : [])
      
      // Test classes
      console.log('Testing classes...')
      const classResponse = await apiClient.getClasses()
      console.log('Classes response:', classResponse)
      setClasses(Array.isArray(classResponse) ? classResponse : [])
      
      // Test subjects
      console.log('Testing subjects...')
      const subjectResponse = await apiClient.getSubjects()
      console.log('Subjects response:', subjectResponse)
      setSubjects(Array.isArray(subjectResponse) ? subjectResponse : [])
      
      // Test users
      console.log('Testing users...')
      const userResponse = await apiClient.getUsers()
      console.log('Users response:', userResponse)
      setUsers(Array.isArray(userResponse) ? userResponse : [])
      
      console.log('All APIs tested successfully!')
      
    } catch (err) {
      console.error('API test error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    testAPIs()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">API Debug Page</h1>
      
      <button 
        onClick={testAPIs}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        {loading ? 'Testing...' : 'Test APIs Again'}
      </button>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Departments ({departments.length})</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-64">
            {JSON.stringify(departments, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Classes ({classes.length})</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-64">
            {JSON.stringify(classes, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Subjects ({subjects.length})</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-64">
            {JSON.stringify(subjects, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Users ({users.length})</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-64">
            {JSON.stringify(users, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}


