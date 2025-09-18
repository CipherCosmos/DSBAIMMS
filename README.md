# LMS System - CO/PO-focused Learning Management System

A comprehensive Learning Management System built with microservices architecture, specifically designed for CO/PO (Course Outcomes/Program Outcomes) attainment analysis in colleges and universities.

## 🏗️ Architecture

### Microservices
- **API Gateway**: Kong (Port 8000)
- **Auth Service**: FastAPI (Port 8010) - Authentication & Authorization
- **User Service**: FastAPI (Port 8011) - User Management
- **Department Service**: FastAPI (Port 8012) - Departments, Classes, Subjects, CO/PO
- **Exam Service**: FastAPI (Port 8013) - Exam & Question Management
- **Marks Service**: FastAPI (Port 8014) - Marks Entry & Processing
- **Analytics Service**: FastAPI (Port 8015) - CO/PO Analytics & Reports
- **Bulk Service**: FastAPI (Port 8016) - Bulk Upload Operations
- **Export Service**: FastAPI (Port 8017) - Data Export & Reports

### Frontend
- **Next.js 13**: React with App Router (Port 3000)
- **Tailwind CSS**: Responsive UI design
- **TypeScript**: Type-safe development

### Databases & Storage
- **PostgreSQL**: Primary database with comprehensive schema
- **Redis**: Caching & session management
- **Kafka**: Event streaming for analytics

## 🚀 Features

### Role-based Access Control
- **Admin**: Full system access, user management, department setup
- **HOD**: Department-specific management and analytics  
- **Teacher**: Subject management, exam creation, marks entry
- **Student**: Personal analytics and performance tracking

### Core Functionality
- **Complete User Management**: CRUD operations with role-based permissions
- **Academic Structure**: Departments, Classes, Subjects with relationships
- **CO/PO Management**: Course Outcomes and Program Outcomes with mappings
- **Exam System**: Multi-section exams with Bloom's taxonomy
- **Marks Processing**: Advanced scoring algorithms for optional questions
- **Real-time Analytics**: CO/PO attainment calculations and visualizations
- **Bulk Operations**: Excel/CSV upload for users, marks, questions
- **Audit Logging**: Complete activity tracking for compliance

### Analytics & Reporting
- **Question-level**: Difficulty index, discrimination analysis
- **Exam-level**: Pass/fail rates, reliability metrics  
- **CO/PO-level**: Attainment percentages, trend analysis
- **Student Performance**: Individual progress tracking
- **Department Analytics**: Comparative analysis across departments

## 🛠️ Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)

### 1. Clone & Setup
```bash
git clone <repository-url>
cd lms-system
```

### 2. Start Services
```bash
# Start all services with Docker Compose
npm run dev

# Or start services individually
docker-compose up postgres redis kafka zookeeper
docker-compose up auth-service user-service department-service
```

### 3. Access the System
- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8000
- **Individual Services**: Ports 8010-8017

### 4. Login Credentials
```
Admin:    admin / admin123
HOD:      hod_cse / admin123  
Teacher:  teacher1 / admin123
Student:  student1 / admin123
```

## 📊 Database Schema

### Core Tables
- `users` - User accounts with role-based permissions
- `departments` - Academic departments with HOD assignments
- `classes` - Class sections with teacher assignments
- `subjects` - Course subjects with CO mappings
- `cos` - Course Outcomes
- `pos` - Program Outcomes  
- `co_po_mappings` - CO-PO relationship mappings
- `exams` - Exam configurations
- `exam_sections` - Exam sections (A/B/C)
- `questions` - Questions with Bloom's taxonomy
- `marks` - Student marks with grading metadata
- `audit_logs` - Complete audit trail

### Key Relationships
- Users belong to Departments and Classes
- Subjects are taught by Teachers to specific Classes
- Questions map to Course Outcomes (COs)
- COs map to Program Outcomes (POs) with strength weights
- Marks link Students, Exams, and Questions

## 🔧 Development

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Backend Development
```bash
cd services/auth  # or any service
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
```

### Database Management
```bash
# Connect to PostgreSQL
docker exec -it lms-system_postgres_1 psql -U lms_user -d lms_db

# View logs
docker-compose logs -f postgres
```

## 📈 Production Deployment

### Environment Variables
Create `.env` files for each service:
```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
REDIS_URL=redis://host:6379
JWT_SECRET=your-production-secret
KAFKA_URL=kafka:9092
```

### Kubernetes Deployment
```bash
# Build images
docker-compose build

# Deploy to Kubernetes
kubectl apply -f k8s/
```

### Scaling
- Each microservice can be scaled independently
- Database connection pooling configured
- Redis clustering for high availability
- Kafka partitioning for high throughput

## 📚 API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### User Management  
- `GET /api/users` - List users (with filters)
- `POST /api/users` - Create user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### Academic Management
- `GET /api/departments` - List departments
- `GET /api/classes` - List classes  
- `GET /api/subjects` - List subjects
- `GET /api/cos` - List course outcomes
- `GET /api/pos` - List program outcomes

Full API documentation available at `/docs` for each service.

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-based Authorization**: Granular permission control
- **Audit Logging**: Complete activity tracking
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Comprehensive data validation
- **CORS Configuration**: Secure cross-origin requests

## 📋 Testing

### Unit Tests
```bash
cd services/auth
python -m pytest tests/
```

### Integration Tests
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Load Testing
```bash
# Install k6
brew install k6

# Run load tests
k6 run tests/load/login-test.js
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation in `/docs`
- Review API documentation at service `/docs` endpoints

## 🎯 Roadmap

- [ ] Machine Learning recommendations
- [ ] Advanced analytics dashboards  
- [ ] Mobile app development
- [ ] Integration with external LMS platforms
- [ ] Blockchain-based certificate verification
- [ ] AI-powered question generation