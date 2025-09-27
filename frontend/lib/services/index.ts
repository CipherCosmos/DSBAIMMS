// Export all services for easy importing
export { BaseService } from './base.service'
export type { ServiceConfig, ApiResponse, PaginatedResponse } from './base.service'

export { AuthService } from './auth.service'
export type { 
  LoginCredentials, 
  User, 
  AuthResponse, 
  ChangePasswordRequest 
} from './auth.service'

export { UsersService } from './users.service'
export type { 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserStats, 
  BulkUpdateRequest 
} from './users.service'

export { DepartmentsService } from './departments.service'
export type { 
  CreateDepartmentRequest, 
  UpdateDepartmentRequest, 
  Department, 
  AvailableHOD 
} from './departments.service'

export { SemestersService } from './semesters.service'
export type { 
  CreateSemesterRequest, 
  UpdateSemesterRequest, 
  Semester, 
  PromotionRequest, 
  PromotionStatus 
} from './semesters.service'

export { ClassesService } from './classes.service'
export type { 
  CreateClassRequest, 
  UpdateClassRequest, 
  Class, 
  ClassStudent, 
  ClassAnalytics 
} from './classes.service'

export { SubjectsService } from './subjects.service'
export type { 
  CreateSubjectRequest, 
  UpdateSubjectRequest, 
  Subject, 
  SubjectAnalytics 
} from './subjects.service'

export { ExamsService } from './exams.service'
export type { 
  CreateExamRequest, 
  UpdateExamRequest, 
  Exam, 
  ExamSection, 
  ExamQuestion, 
  ExamAnalytics 
} from './exams.service'

export { AnalyticsService } from './analytics.service'
export type { 
  DashboardStats, 
  COAttainmentData, 
  POAttainmentData, 
  StudentPerformanceData, 
  QuestionAnalytics, 
  ExamAnalyticsData, 
  TrendData, 
  MLRecommendation 
} from './analytics.service'

export { FilesService } from './files.service'
export type { 
  UploadFileRequest, 
  FileRecord, 
  FileCategory, 
  StorageStats 
} from './files.service'

export { NotificationsService } from './notifications.service'
export type { 
  CreateNotificationRequest, 
  UpdateNotificationRequest, 
  Notification, 
  NotificationStats, 
  SystemStats 
} from './notifications.service'

// Import service classes first
import { AuthService } from './auth.service'
import { UsersService } from './users.service'
import { DepartmentsService } from './departments.service'
import { SemestersService } from './semesters.service'
import { ClassesService } from './classes.service'
import { SubjectsService } from './subjects.service'
import { ExamsService } from './exams.service'
import { AnalyticsService } from './analytics.service'
import { FilesService } from './files.service'
import { NotificationsService } from './notifications.service'

// Service instances for easy access
export const authService = new AuthService()
export const usersService = new UsersService()
export const departmentsService = new DepartmentsService()
export const semestersService = new SemestersService()
export const classesService = new ClassesService()
export const subjectsService = new SubjectsService()
export const examsService = new ExamsService()
export const analyticsService = new AnalyticsService()
export const filesService = new FilesService()
export const notificationsService = new NotificationsService()
