# Learning Management System (LMS)

A comprehensive Learning Management System built with microservices architecture, featuring role-based access control, advanced analytics, and modern web technologies.

## 🏗️ Architecture

### Backend Services
- **FastAPI** microservices architecture
- **PostgreSQL** for transactional data
- **MongoDB** for analytics and logs
- **JWT** authentication
- **Role-based access control** (Admin, HOD, Teacher, Student)

### Frontend
- **Next.js 15** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Responsive design** with mobile support

## 📁 Project Structure

```
lms/
├── services/                 # Backend microservices
│   ├── admin/               # Admin management service
│   ├── analytics/           # Analytics and reporting
│   ├── auth/               # Authentication service
│   ├── classes/            # Class management
│   ├── copo/               # CO/PO attainment
│   ├── departments/        # Department management
│   ├── exams/              # Exam management
│   ├── hod/                # HOD-specific features
│   ├── marks/              # Marks management
│   ├── notifications/      # Notification system
│   ├── promotion/          # Student promotion
│   ├── semesters/          # Semester management
│   ├── student/            # Student features
│   ├── subjects/           # Subject management
│   ├── teacher/            # Teacher features
│   └── users/              # User management
├── shared/                 # Shared backend components
│   ├── auth/              # Authentication utilities
│   ├── database/          # Database configuration
│   ├── models/            # SQLAlchemy models
│   ├── permissions/       # Permission system
│   └── schemas/           # Pydantic schemas
├── frontend/              # Next.js frontend application
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── lib/               # Utilities and services
│   └── types/             # TypeScript type definitions
├── config/                # Configuration files
│   ├── database/          # Database schemas and migrations
│   └── deployment/        # Deployment configurations (Kong, etc.)
├── docs/                  # Documentation
│   ├── implementation/    # Implementation details
│   ├── analysis/          # Analysis documents
│   └── refactoring/       # Refactoring documentation
├── scripts/               # Utility scripts
│   └── seed_data.py       # Database seeding script
├── docker-compose.yml     # Docker orchestration
├── docker-compose.dev.yml # Development Docker setup
├── requirements.txt       # Python dependencies
└── README.md             # Project documentation
```

## 🚀 Features

### Core Features
- **User Management**: Complete user lifecycle management
- **Department Management**: Hierarchical department structure
- **Class Management**: Class creation and student assignment
- **Subject Management**: Subject creation with prerequisites
- **Exam Management**: Flexible exam creation with optional questions
- **Marks Management**: Comprehensive marks entry and calculation
- **Student Promotion**: Automated promotion system
- **Analytics**: Advanced reporting and analytics

### Advanced Features
- **CO/PO Attainment**: Course and Program Outcome tracking
- **Bulk Operations**: Import/export functionality
- **Role-based Dashboards**: Customized views per role
- **Real-time Notifications**: WebSocket-based notifications
- **Audit Logging**: Complete action tracking
- **Responsive Design**: Mobile-first approach

## 🛠️ Technology Stack

### Backend
- **Python 3.11+**
- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Pydantic** - Data validation
- **PostgreSQL** - Primary database
- **MongoDB** - Analytics database
- **Redis** - Caching and sessions

### Frontend
- **Node.js 18+**
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Query** - State management

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- MongoDB 6+
- Redis 6+

## 🚀 Quick Start

### Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env

# Run database migrations
python -m alembic upgrade head

# Start services
docker-compose up -d
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📚 Documentation

- [API Documentation](docs/api/)
- [Deployment Guide](docs/deployment/)
- [Implementation Details](docs/implementation/)
- [Architecture Analysis](docs/analysis/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions, please open an issue in the repository.