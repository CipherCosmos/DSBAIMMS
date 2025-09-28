# Comprehensive LMS Specification — Admin, HOD, Teacher, Student Views with Semester Context

## Overview

This document defines the **complete functional, analytical, and architectural specification** for a Learning Management System (LMS) designed for higher education institutions. The LMS must support **multi-level roles** (Admin/Principal, HOD, Teacher, Student), maintain the academic hierarchy (**Department → Semester → Class → Subject → Exam → Student**), integrate **advanced analytics and bulk operations**, and be implemented on a **scalable, secure, microservice-based architecture**.

All development, modifications, and implementations must strictly follow this specification to ensure accuracy, consistency, and long-term maintainability.

If any changes are made to the codebase, the AI must automatically update all affected parts of the application to maintain consistency—but only after confirming that the current implementation is successful and correct. Incorrect or unverified changes must not propagate globally.

**No mock data or mock implementations are allowed at any point.**

---

## Core Data Hierarchy

1. **Institution → Departments**

   * Each department includes:

     * Assigned HOD
     * Academic year(s)
     * Duration (auto-calculated from year & semesters)
     * Number of semesters
     * Linked classes, subjects, teachers, and students

2. **Department → Semesters**

   * Each department has multiple semesters.
   * Each semester contains classes, subjects, exams, and enrolled students.
   * Student promotion and data continuity across semesters must be maintained.

3. **Semester → Classes**

   * Attributes:

     * Assigned Class Teacher
     * Assigned Class Representative (CR)
     * Enrolled Students
     * Linked Subjects
     * Exams per subject
     * Semester progress tracking

4. **Class → Subjects**

   * Each subject belongs to a semester and maps to one or more classes.
   * Attributes:

     * Assigned Teacher(s)
     * Student enrollment mapping
     * CO (Course Outcomes) and PO (Program Outcomes) targets
     * Linked exams and performance history

5. **Subject → Exams**

   * Attributes:

     * Structure: Sections A, B, C (with optional/sub-questions)
     * Question metadata: Bloom’s taxonomy level, difficulty level
     * Question → CO mapping → auto PO mapping
     * Student attempts and marks
     * Exam weightage and calculation rules

6. **Student → Exam Attempts**

   * Each attempt includes:

     * Answers per question (including optional/sub-questions)
     * Marks obtained (auto-calculated from rules)
     * CO/PO contribution
     * Performance history across semesters and subjects

---

## Role-Based Features

### 1. Admin (Principal)

* Department Management (create/manage, assign HODs, configure academic years/semesters).
* Class Management (create/manage, assign teachers and CRs, link subjects and students).
* User Management (CRUD for HODs, Teachers, Students, Admins).
* Subject Management (CRUD, teacher assignment, semester/class linking).
* CO/PO Management (define/manage, set thresholds/targets).
* Global Analytics (institution-wide drilldowns: department, semester, class, subject, exam, teacher effectiveness, student performance, CO/PO, Bloom’s taxonomy, difficulty levels, attendance correlations, attrition tracking).
* Platform Analytics (system health, active users, concurrency, security logs).
* Bulk Operations (bulk user creation, enrollment, subject upload, exam/marks upload with validation).

### 2. HOD

* Scope restricted to department.
* Class Management (CRUD, assign teachers and CRs).
* User Management (CRUD for teachers and students only).
* Subject Management (CRUD and teacher assignment).
* Department-specific CO/PO management.
* Department Analytics (semester → class → subject → exam, teacher performance, student results, CO/PO, Bloom’s, difficulty-level analysis).
* Report exports (Excel, PDF, CSV).
* Bulk operations (teachers, students, subjects, marks, questions).

### 3. Teacher

* Exam Management (create/configure, handle optional/sub-questions, map to Bloom’s, difficulty, CO/PO).
* Marks Entry (UI, auto-calculation for optional/best attempts).
* Subject Analytics (question-level, Bloom’s/difficulty distribution, CO/PO attainment, student performance, exportable reports).
* Bulk operations (questions, marks).

### 4. Student

* Performance Dashboard (semester, subject, exam breakdown, CO/PO attainment, Bloom’s/difficulty mastery, improvement suggestions).
* Profile Management (update personal data, profile picture, password).

---

## Common Features

* Profile management for all roles.
* Dynamic UI rendering per role.
* Security (JWT auth, RBAC, audit logs).
* Real-time performance (caching, load balancing).
* Microservices design for modularity.
* Bulk operations with validations.
* Persistent analytics and data.

---

## System Design Principles

1. **Microservices Architecture**

   * Dedicated services: Users, Departments, Classes, Subjects, Exams, Analytics, CO/PO.
   * REST + WebSocket APIs for communication.

2. **Database Design**

   * Relational DB (Postgres/MySQL) for transactional data.
   * NoSQL (MongoDB) for logs/analytics.
   * Mapping tables for many-to-many relationships.

3. **Analytics Pipeline**

   * ETL jobs for aggregation.
   * Pre-computed analytics cached in Redis.
   * On-demand drill-down reporting.

4. **Scalability & Performance**

   * Load balancing and caching with Redis.
   * Scalable to thousands of users for single institution.

5. **Security**

   * Strict RBAC.
   * Encrypted sensitive data.
   * Audit trails for Admin/HOD operations.

---

## Acceptance Criteria

* Admin: Institution-wide analytics visibility.
* HOD: Department-only analytics visibility.
* Teacher: Subject-only analytics visibility.
* Student: Personal analytics only.
* Optional question handling: auto best-attempt scoring.
* Persistent analytics retrievable anytime.
* Bulk features must validate and handle errors gracefully.

---

## Conclusion

This LMS specification defines a **complete academic and analytical ecosystem**. It enforces hierarchical data integrity, role-based access, multi-level analytics, and cross-semester tracking. The design ensures **scalability, security, accuracy, and maintainability**, making it suitable for large institutions with thousands of students and faculty.

All AI-driven development must reference this document for every implementation, modification, and enhancement to guarantee consistency with the intended system.

Any code changes must automatically propagate across all dependent modules **only after successful implementation and validation**. Unverified or incorrect changes must not cascade.

**No mock data, mock logic, or placeholder implementations are allowed.**
