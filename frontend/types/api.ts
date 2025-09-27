// API Response Types
export interface ApiResponse<T = any> {
  data: T
  status: number
  success: boolean
}

export interface ApiError {
  status: number
  message: string
  data?: any
  url?: string
  method?: string
}

// User Types
export interface User {
  id: number
  username: string
  email: string
  full_name: string
  first_name?: string
  last_name?: string
  role: 'admin' | 'hod' | 'teacher' | 'student'
  phone?: string
  address?: string
  department_id?: number
  department_name?: string
  class_id?: number
  class_name?: string
  student_id?: string
  employee_id?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  qualification?: string
  experience_years?: number
  subject_ids?: number[]
  subjects?: Subject[]
  specializations?: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  last_login?: string
  profile_picture?: string
}

export interface UserCreate {
  username: string
  email: string
  password: string
  role: string
  first_name?: string
  last_name?: string
  phone?: string
  address?: string
  department_id?: number
  class_id?: number
  student_id?: string
  employee_id?: string
  date_of_birth?: string
  gender?: string
  qualification?: string
  experience_years?: number
  subject_ids?: number[]
  specializations?: string[]
}

export interface UserUpdate {
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  address?: string
  department_id?: number
  class_id?: number
  student_id?: string
  employee_id?: string
  date_of_birth?: string
  gender?: string
  qualification?: string
  experience_years?: number
  subject_ids?: number[]
  specializations?: string[]
  is_active?: boolean
}

// Department Types
export interface Department {
  id: number
  name: string
  description?: string
  hod_id?: number
  hod_name?: string
  academic_year?: string
  duration_years?: number
  number_of_semesters?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DepartmentCreate {
  name: string
  description?: string
  hod_id?: number
  academic_year?: string
  duration_years?: number
  number_of_semesters?: number
}

export interface DepartmentUpdate {
  name?: string
  description?: string
  hod_id?: number
  academic_year?: string
  duration_years?: number
  number_of_semesters?: number
  is_active?: boolean
}

// Class Types
export interface Class {
  id: number
  name: string
  department_id: number
  department_name?: string
  semester_id?: number
  semester_name?: string
  class_teacher_id?: number
  class_teacher_name?: string
  class_representative_id?: number
  class_representative_name?: string
  academic_year?: string
  is_active: boolean
  created_at: string
  updated_at: string
  student_count?: number
  subject_count?: number
}

export interface ClassCreate {
  name: string
  department_id: number
  semester_id?: number
  class_teacher_id?: number
  class_representative_id?: number
  academic_year?: string
}

export interface ClassUpdate {
  name?: string
  department_id?: number
  semester_id?: number
  class_teacher_id?: number
  class_representative_id?: number
  academic_year?: string
  is_active?: boolean
}

// Subject Types
export interface Subject {
  id: number
  name: string
  code?: string
  description?: string
  department_id: number
  department_name?: string
  semester_id?: number
  semester_name?: string
  credits?: number
  teacher_ids?: number[]
  teachers?: User[]
  is_active: boolean
  created_at: string
  updated_at: string
  student_count?: number
}

export interface SubjectCreate {
  name: string
  code?: string
  description?: string
  department_id: number
  semester_id?: number
  credits?: number
  teacher_ids?: number[]
}

export interface SubjectUpdate {
  name?: string
  code?: string
  description?: string
  department_id?: number
  semester_id?: number
  credits?: number
  teacher_ids?: number[]
  is_active?: boolean
}

// Semester Types
export interface Semester {
  id: number
  name: string
  department_id: number
  department_name?: string
  academic_year?: string
  start_date?: string
  end_date?: string
  is_active: boolean
  created_at: string
  updated_at: string
  class_count?: number
  subject_count?: number
  student_count?: number
}

export interface SemesterCreate {
  name: string
  department_id: number
  academic_year?: string
  start_date?: string
  end_date?: string
}

export interface SemesterUpdate {
  name?: string
  department_id?: number
  academic_year?: string
  start_date?: string
  end_date?: string
  is_active?: boolean
}

// Field Configuration Types
export interface FieldConfig {
  required_fields: string[]
  optional_fields: string[]
  hidden_fields: string[]
  field_labels: Record<string, string>
  field_validation: Record<string, any>
}

// Statistics Types
export interface UserStats {
  total_users: number
  active_users: number
  users_by_role: {
    admin: number
    hod: number
    teacher: number
    student: number
  }
  recent_registrations: number
  department_distribution: Array<{
    department_id: number
    department_name: string
    user_count: number
  }>
}

export interface DepartmentStats {
  total_departments: number
  active_departments: number
  departments_with_hods: number
  average_classes_per_department: number
  average_subjects_per_department: number
}

export interface ClassStats {
  total_classes: number
  active_classes: number
  classes_with_teachers: number
  average_students_per_class: number
  department_distribution: Array<{
    department_id: number
    department_name: string
    class_count: number
  }>
}

// Pagination Types
export interface PaginationParams {
  skip?: number
  limit?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  skip: number
  limit: number
  has_more: boolean
}

// Filter Types
export interface UserFilters {
  role?: string
  department_id?: number
  class_id?: number
  is_active?: boolean
  search?: string
}

export interface DepartmentFilters {
  is_active?: boolean
  has_hod?: boolean
  search?: string
}

export interface ClassFilters {
  department_id?: number
  semester_id?: number
  is_active?: boolean
  search?: string
}

export interface SubjectFilters {
  department_id?: number
  semester_id?: number
  teacher_id?: number
  is_active?: boolean
  search?: string
}
