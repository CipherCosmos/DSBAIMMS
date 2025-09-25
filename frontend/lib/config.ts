// Configuration for dynamic dropdown options and system settings

export const SYSTEM_CONFIG = {
  // Academic years - generate dynamically based on current year
  getAcademicYears: (yearsBack: number = 5, yearsForward: number = 2) => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = yearsBack; i >= 0; i--) {
      years.push(currentYear - i)
    }
    for (let i = 1; i <= yearsForward; i++) {
      years.push(currentYear + i)
    }
    return years
  },

  // Duration options for departments
  DURATION_OPTIONS: [
    { value: 1, label: '1 Year' },
    { value: 2, label: '2 Years' },
    { value: 3, label: '3 Years' },
    { value: 4, label: '4 Years' },
    { value: 5, label: '5 Years' },
    { value: 6, label: '6 Years' }
  ],

  // Semester count options
  SEMESTER_COUNT_OPTIONS: [
    { value: 2, label: '2 Semesters' },
    { value: 4, label: '4 Semesters' },
    { value: 6, label: '6 Semesters' },
    { value: 8, label: '8 Semesters' },
    { value: 10, label: '10 Semesters' },
    { value: 12, label: '12 Semesters' }
  ],

  // Section options - can be configured per department
  SECTION_OPTIONS: [
    { value: 'A', label: 'Section A' },
    { value: 'B', label: 'Section B' },
    { value: 'C', label: 'Section C' },
    { value: 'D', label: 'Section D' },
    { value: 'E', label: 'Section E' },
    { value: 'F', label: 'Section F' }
  ],

  // Current semester options (1-8 typically)
  CURRENT_SEMESTER_OPTIONS: Array.from({ length: 8 }, (_, i) => ({
    value: i + 1,
    label: `Semester ${i + 1}`
  })),

  // Status options
  STATUS_OPTIONS: [
    { value: 'all', label: 'All Status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' }
  ],

  // Sort options
  SORT_OPTIONS: {
    departments: [
      { value: 'name-asc', label: 'Name A-Z' },
      { value: 'name-desc', label: 'Name Z-A' },
      { value: 'code-asc', label: 'Code A-Z' },
      { value: 'code-desc', label: 'Code Z-A' },
      { value: 'created_at-desc', label: 'Newest First' },
      { value: 'created_at-asc', label: 'Oldest First' }
    ],
    classes: [
      { value: 'name', label: 'Name' },
      { value: 'year', label: 'Year' },
      { value: 'created_at', label: 'Created' }
    ],
    subjects: [
      { value: 'name', label: 'Sort by Name' },
      { value: 'code', label: 'Sort by Code' },
      { value: 'created_at', label: 'Sort by Date' }
    ]
  },

  // Role-based permissions
  PERMISSIONS: {
    admin: [
      'create_departments',
      'update_departments',
      'delete_departments',
      'view_all_departments',
      'create_semesters',
      'update_semesters',
      'delete_semesters',
      'view_all_semesters',
      'create_classes',
      'update_classes',
      'delete_classes',
      'view_all_classes',
      'create_subjects',
      'update_subjects',
      'delete_subjects',
      'view_all_subjects',
      'assign_hods',
      'assign_teachers',
      'assign_crs'
    ],
    hod: [
      'view_own_department',
      'create_semesters',
      'update_semesters',
      'delete_semesters',
      'view_department_semesters',
      'create_classes',
      'update_classes',
      'delete_classes',
      'view_department_classes',
      'create_subjects',
      'update_subjects',
      'delete_subjects',
      'view_department_subjects',
      'assign_teachers',
      'assign_crs'
    ],
    teacher: [
      'view_assigned_subjects',
      'view_assigned_classes',
      'view_department_info'
    ],
    student: [
      'view_enrolled_classes',
      'view_enrolled_subjects',
      'view_department_info'
    ]
  }
}

// Helper function to check permissions
export const hasPermission = (userRole: string, permission: string): boolean => {
  const rolePermissions = SYSTEM_CONFIG.PERMISSIONS[userRole as keyof typeof SYSTEM_CONFIG.PERMISSIONS]
  return rolePermissions ? rolePermissions.includes(permission) : false
}

// Helper function to get academic year string
export const getAcademicYearString = (year: number): string => {
  return `${year}-${(year + 1).toString().slice(-2)}`
}

// Helper function to generate class name
export const generateClassName = (departmentCode: string, year: number, semester: number, section: string): string => {
  return `${departmentCode}-${section}-${year}-S${semester}`
}
