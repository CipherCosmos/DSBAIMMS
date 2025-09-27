import {
  AuthService,
  UsersService,
  DepartmentsService,
  SemestersService,
  ClassesService,
  SubjectsService,
  ExamsService,
  AnalyticsService,
  FilesService,
  NotificationsService
} from './index'
import { apiClient } from '../api-client'

/**
 * Service Registry for centralized service management
 * Provides singleton instances and service discovery
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry
  private services: Map<string, any> = new Map()

  private constructor() {
    this.initializeServices()
  }

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry()
    }
    return ServiceRegistry.instance
  }

  private initializeServices() {
    // Register all services
    this.services.set('auth', new AuthService())
    this.services.set('users', new UsersService())
    this.services.set('departments', new DepartmentsService())
    this.services.set('semesters', new SemestersService())
    this.services.set('classes', new ClassesService())
    this.services.set('subjects', new SubjectsService())
    this.services.set('exams', new ExamsService())
    this.services.set('analytics', new AnalyticsService())
    this.services.set('files', new FilesService())
    this.services.set('notifications', new NotificationsService())
    this.services.set('questionbanks', apiClient)
    this.services.set('bulk', apiClient)
  }

  /**
   * Get a service instance by name
   */
  public getService<T>(serviceName: string): T {
    const service = this.services.get(serviceName)
    if (!service) {
      throw new Error(`Service '${serviceName}' not found in registry`)
    }
    return service as T
  }

  /**
   * Get all available service names
   */
  public getAvailableServices(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * Check if a service exists in the registry
   */
  public hasService(serviceName: string): boolean {
    return this.services.has(serviceName)
  }

  /**
   * Register a new service
   */
  public registerService<T>(serviceName: string, service: T): void {
    this.services.set(serviceName, service)
  }

  /**
   * Unregister a service
   */
  public unregisterService(serviceName: string): boolean {
    return this.services.delete(serviceName)
  }

  /**
   * Clear all services (useful for testing)
   */
  public clear(): void {
    this.services.clear()
    this.initializeServices()
  }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance()

// Convenience exports for direct access
export const authService = serviceRegistry.getService<AuthService>('auth')
export const usersService = serviceRegistry.getService<UsersService>('users')
export const departmentsService = serviceRegistry.getService<DepartmentsService>('departments')
export const semestersService = serviceRegistry.getService<SemestersService>('semesters')
export const classesService = serviceRegistry.getService<ClassesService>('classes')
export const subjectsService = serviceRegistry.getService<SubjectsService>('subjects')
export const examsService = serviceRegistry.getService<ExamsService>('exams')
export const analyticsService = serviceRegistry.getService<AnalyticsService>('analytics')
export const filesService = serviceRegistry.getService<FilesService>('files')
export const notificationsService = serviceRegistry.getService<NotificationsService>('notifications')
