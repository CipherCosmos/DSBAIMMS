#!/usr/bin/env python3
"""
Comprehensive seed data script for LMS
Creates realistic data with proper relationships for testing
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import text
from shared.database import get_db
from shared.models import User, Department, Class, Subject, Exam, Question, Mark, AuditLog, Notification, Semester, CO, PO, COPOMapping, StudentSem  # ...
from datetime import datetime, timedelta
import random
from decimal import Decimal

def create_seed_data():
    """Create comprehensive seed data with proper relationships"""
    db = next(get_db())

    try:
        print("🌱 Creating comprehensive seed data...")

        # Clear existing data using CASCADE
        print("🧹 Clearing existing data...")
        # Disable foreign key checks temporarily and truncate with CASCADE
        db.execute(text("SET session_replication_role = replica;"))
        db.execute(text("TRUNCATE TABLE marks CASCADE;"))
        db.execute(text("TRUNCATE TABLE questions CASCADE;"))
        db.execute(text("TRUNCATE TABLE exams CASCADE;"))
        db.execute(text("TRUNCATE TABLE co_po_mappings CASCADE;"))
        db.execute(text("TRUNCATE TABLE cos CASCADE;"))
        db.execute(text("TRUNCATE TABLE pos CASCADE;"))
        db.execute(text("TRUNCATE TABLE subjects CASCADE;"))
        db.execute(text("TRUNCATE TABLE student_semester_enrollments CASCADE;"))
        db.execute(text("TRUNCATE TABLE classes CASCADE;"))
        db.execute(text("TRUNCATE TABLE semesters CASCADE;"))
        db.execute(text("TRUNCATE TABLE users CASCADE;"))
        db.execute(text("TRUNCATE TABLE departments CASCADE;"))
        db.execute(text("SET session_replication_role = DEFAULT;"))
        db.commit()

        # 1. Create Departments
        print("🏢 Creating departments...")
        departments = []
        dept_data = [
            {"name": "Computer Science and Engineering", "code": "CSE", "description": "Department of Computer Science and Engineering"},
            {"name": "Electronics and Communication Engineering", "code": "ECE", "description": "Department of Electronics and Communication Engineering"},
            {"name": "Mechanical Engineering", "code": "MECH", "description": "Department of Mechanical Engineering"},
            {"name": "Civil Engineering", "code": "CIVIL", "description": "Department of Civil Engineering"},
            {"name": "Information Technology", "code": "IT", "description": "Department of Information Technology"}
        ]

        for dept_info in dept_data:
            dept = Department(
                name=dept_info["name"],
                code=dept_info["code"],
                description=dept_info["description"],
                duration_years=4,
                academic_year="2024-25",
                semester_count=8,
                current_semester=1,
                is_active=True
            )
            db.add(dept)
            departments.append(dept)

        db.commit()

        # 2. Create Users (Admin, HODs, Teachers, Students)
        print("👥 Creating users...")
        users = []

        # Admin users
        admin = User(
            username="admin",
            email="admin@lms.edu",
            full_name="System Administrator",
            hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2",  # admin123
            role="admin",
            is_active=True,
            employee_id="ADM001"
        )
        db.add(admin)
        users.append(admin)

        # HOD users
        hod_users = []
        for i, dept in enumerate(departments):
            hod = User(
                username=f"hod_{dept.code.lower()}",
                email=f"hod_{dept.code.lower()}@lms.edu",
                full_name=f"HOD {dept.name}",
                hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2",  # admin123
                role="hod",
                is_active=True,
                department_id=dept.id,
                employee_id=f"HOD{dept.code}001"
            )
            db.add(hod)
            users.append(hod)
            hod_users.append(hod)
            dept.hod_id = hod.id

        # Teacher users
        teacher_users = []
        for i, dept in enumerate(departments):
            for j in range(3):  # 3 teachers per department
                teacher = User(
                    username=f"teacher_{dept.code.lower()}_{j+1}",
                    email=f"teacher_{dept.code.lower()}_{j+1}@lms.edu",
                    full_name=f"Teacher {j+1} {dept.name}",
                    hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2",  # admin123
                    role="teacher",
                    is_active=True,
                    department_id=dept.id,
                    employee_id=f"TCH{dept.code}{j+1:03d}",
                    qualification="M.Tech",
                    experience_years=random.randint(2, 15)
                )
                db.add(teacher)
                users.append(teacher)
                teacher_users.append(teacher)

        # Student users
        student_users = []
        for i, dept in enumerate(departments):
            for j in range(20):  # 20 students per department
                student = User(
                    username=f"student_{dept.code.lower()}_{j+1:03d}",
                    email=f"student_{dept.code.lower()}_{j+1:03d}@lms.edu",
                    full_name=f"Student {j+1} {dept.name}",
                    hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2",  # admin123
                    role="student",
                    is_active=True,
                    department_id=dept.id,
                    student_id=f"STU{dept.code}{j+1:03d}",
                    date_of_birth=datetime.now() - timedelta(days=random.randint(18*365, 22*365))
                )
                db.add(student)
                users.append(student)
                student_users.append(student)

        db.commit()

        # 3. Create Semesters
        print("📅 Creating semesters...")
        semesters = []
        for dept in departments:
            for sem_num in range(1, 9):  # 8 semesters
                semester = Semester(
                    name=f"Semester {sem_num}",
                    semester_number=sem_num,
                    academic_year="2024-25",
                    start_date=datetime.now() - timedelta(days=30*sem_num),
                    end_date=datetime.now() + timedelta(days=30*(8-sem_num)),
                    is_active=sem_num <= 2,  # First 2 semesters are active
                    department_id=dept.id
                )
                db.add(semester)
                semesters.append(semester)

        db.commit()

        # 4. Create Classes
        print("🏫 Creating classes...")
        classes = []
        for semester in semesters:
            if semester.semester_number <= 4:  # Only create classes for first 4 semesters
                for section in ['A', 'B', 'C']:
                    class_obj = Class(
                        name=f"Year {(semester.semester_number-1)//2 + 1} {section}",
                        year=(semester.semester_number-1)//2 + 1,
                        semester_id=semester.id,
                        section=section,
                        department_id=semester.department_id,
                        max_students=30,
                        description=f"Class for {semester.name} Section {section}",
                        is_active=True
                    )
                    db.add(class_obj)
                    classes.append(class_obj)

        db.commit()

        # 5. Assign students to classes
        print("👨‍🎓 Assigning students to classes...")
        class_index = 0
        for student in student_users:
            if class_index < len(classes):
                student.class_id = classes[class_index].id
                class_index = (class_index + 1) % len(classes)

        # Assign class teachers
        teacher_index = 0
        for class_obj in classes:
            if teacher_index < len(teacher_users):
                class_obj.class_teacher_id = teacher_users[teacher_index].id
                teacher_index = (teacher_index + 1) % len(teacher_users)

        db.commit()

        # 6. Create Subjects
        print("📚 Creating subjects...")
        subjects = []
        subject_data = [
            {"name": "Data Structures and Algorithms", "code": "CS201", "credits": 4, "theory_marks": 100, "practical_marks": 50},
            {"name": "Database Management Systems", "code": "CS202", "credits": 4, "theory_marks": 100, "practical_marks": 50},
            {"name": "Computer Networks", "code": "CS203", "credits": 3, "theory_marks": 100, "practical_marks": 0},
            {"name": "Software Engineering", "code": "CS204", "credits": 3, "theory_marks": 100, "practical_marks": 0},
            {"name": "Operating Systems", "code": "CS205", "credits": 4, "theory_marks": 100, "practical_marks": 50},
            {"name": "Web Technologies", "code": "CS206", "credits": 3, "theory_marks": 100, "practical_marks": 50},
            {"name": "Machine Learning", "code": "CS207", "credits": 3, "theory_marks": 100, "practical_marks": 0},
            {"name": "Mobile Application Development", "code": "CS208", "credits": 3, "theory_marks": 100, "practical_marks": 50}
        ]

        for dept in departments:
            for i, subject_info in enumerate(subject_data):
                subject = Subject(
                    name=subject_info["name"],
                    code=f"{dept.code}{subject_info['code'][2:]}",
                    description=f"{subject_info['name']} for {dept.name}",
                    credits=subject_info["credits"],
                    theory_marks=subject_info["theory_marks"],
                    practical_marks=subject_info["practical_marks"],
                    department_id=dept.id,
                    is_active=True
                )
                db.add(subject)
                subjects.append(subject)

        db.commit()

        # 7. Assign subjects to classes and teachers
        print("👨‍🏫 Assigning subjects to classes and teachers...")
        teacher_index = 0
        for subject in subjects:
            if teacher_index < len(teacher_users):
                subject.teacher_id = teacher_users[teacher_index].id
                teacher_index = (teacher_index + 1) % len(teacher_users)

            # Assign subject to classes in the same department
            for class_obj in classes:
                if class_obj.department_id == subject.department_id:
                    subject.class_id = class_obj.id
                    break

        db.commit()

        # 8. Create COs and POs
        print("🎯 Creating COs and POs...")
        cos = []
        pos = []

        # Create POs for each department
        po_templates = [
            "Engineering knowledge: Apply the knowledge of mathematics, science, engineering fundamentals",
            "Problem analysis: Identify, formulate, review research literature, and analyze complex engineering problems",
            "Design/development of solutions: Design solutions for complex engineering problems",
            "Conduct investigations: Use research-based knowledge and research methods",
            "Modern tool usage: Create, select, and apply appropriate techniques, resources, and modern engineering tools",
            "The engineer and society: Apply reasoning informed by the contextual knowledge",
            "Environment and sustainability: Understand the impact of professional engineering solutions",
            "Ethics: Apply ethical principles and commit to professional ethics",
            "Individual and team work: Function effectively as an individual, and as a member or leader",
            "Communication: Communicate effectively on complex engineering activities",
            "Project management and finance: Demonstrate knowledge and understanding of engineering and management principles",
            "Life-long learning: Recognize the need for, and have the preparation and ability to engage in independent and life-long learning"
        ]

        for dept in departments:
            for i, po_desc in enumerate(po_templates[:6]):  # First 6 POs
                po = PO(
                    name=f"PO{i+1}",
                    description=po_desc,
                    department_id=dept.id
                )
                db.add(po)
                pos.append(po)

        # Create COs for each subject
        co_templates = [
            "Understand basic concepts and principles",
            "Apply knowledge to solve problems",
            "Analyze and evaluate solutions",
            "Design and develop solutions",
            "Create and implement systems",
            "Evaluate and improve systems"
        ]

        for subject in subjects:
            for i, co_desc in enumerate(co_templates[:4]):  # First 4 COs per subject
                co = CO(
                    name=f"CO{i+1}",
                    description=co_desc,
                    subject_id=subject.id,
                    department_id=subject.department_id
                )
                db.add(co)
                cos.append(co)

        db.commit()

        # 9. Create CO-PO Mappings
        print("🔗 Creating CO-PO mappings...")
        for co in cos:
            # Map each CO to 2-3 POs with random strength
            num_pos = random.randint(2, 3)
            selected_pos = random.sample([po for po in pos if po.department_id == co.department_id], num_pos)

            for po in selected_pos:
                mapping = COPOMapping(
                    co_id=co.id,
                    po_id=po.id,
                    mapping_strength=Decimal(str(random.uniform(1.0, 3.0)))
                )
                db.add(mapping)

        db.commit()

        # 10. Create Exams
        print("📝 Creating exams...")
        exams = []
        for subject in subjects:
            for exam_num in range(1, 4):  # 3 exams per subject
                exam = Exam(
                    title=f"{subject.name} - Exam {exam_num}",
                    description=f"Examination {exam_num} for {subject.name}",
                    subject_id=subject.id,
                    class_id=subject.class_id,
                    exam_type="internal",
                    status="completed",
                    total_marks=subject.theory_marks + subject.practical_marks,
                    duration_minutes=180,
                    exam_date=datetime.now() - timedelta(days=random.randint(1, 30)),
                    start_time=datetime.now() - timedelta(days=random.randint(1, 30)),
                    end_time=datetime.now() - timedelta(days=random.randint(1, 30)) + timedelta(hours=3)
                )
                db.add(exam)
                exams.append(exam)

        db.commit()

        # 11. Create Questions
        print("❓ Creating questions...")
        questions = []
        for exam in exams:
            for q_num in range(1, 6):  # 5 questions per exam
                question = Question(
                    question_text=f"Question {q_num} for {exam.title}",
                    marks=20,
                    difficulty_level=random.choice(["easy", "medium", "hard"]),
                    bloom_level=random.choice(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
                    exam_id=exam.id,
                    subject_id=exam.subject_id
                )
                db.add(question)
                questions.append(question)

        db.commit()

        # 12. Create Marks
        print("📊 Creating marks...")
        for exam in exams:
            # Get students in the same class as the exam
            exam_students = [s for s in student_users if s.class_id == exam.class_id]

            for student in exam_students:
                for question in [q for q in questions if q.exam_id == exam.id]:
                    # Random performance based on difficulty
                    base_performance = 0.7 if question.difficulty_level == "easy" else 0.5 if question.difficulty_level == "medium" else 0.3
                    performance = max(0, min(1, base_performance + random.uniform(-0.2, 0.2)))

                    marks_obtained = Decimal(str(round(question.marks * performance, 2)))
                    max_marks = Decimal(str(question.marks))

                    mark = Mark(
                        student_id=student.id,
                        exam_id=exam.id,
                        question_id=question.id,
                        marks_obtained=marks_obtained,
                        max_marks=max_marks,
                        is_attempted=True,
                        attempt_number=1,
                        is_best_attempt=True,
                        is_counted_for_total=True,
                        bloom_level=question.bloom_level,
                        difficulty_level=question.difficulty_level,
                        graded_by=random.choice([u for u in teacher_users if u.department_id == student.department_id]).id,
                        graded_at=datetime.now() - timedelta(days=random.randint(1, 5))
                    )
                    db.add(mark)

        db.commit()

        print("✅ Seed data created successfully!")
        print(f"📊 Summary:")
        print(f"  - Departments: {len(departments)}")
        print(f"  - Users: {len(users)} (Admin: 1, HODs: {len(hod_users)}, Teachers: {len(teacher_users)}, Students: {len(student_users)})")
        print(f"  - Semesters: {len(semesters)}")
        print(f"  - Classes: {len(classes)}")
        print(f"  - Subjects: {len(subjects)}")
        print(f"  - COs: {len(cos)}")
        print(f"  - POs: {len(pos)}")
        print(f"  - CO-PO Mappings: {db.query(COPOMapping).count()}")
        print(f"  - Exams: {len(exams)}")
        print(f"  - Questions: {len(questions)}")
        print(f"  - Marks: {db.query(Mark).count()}")

    except Exception as e:
        print(f"❌ Error creating seed data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_seed_data()
