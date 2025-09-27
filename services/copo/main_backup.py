from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="CO/PO Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class COCreate(BaseModel):
    name: str
    description: str
    subject_id: int
    department_id: int

class POCreate(BaseModel):
    name: str
    description: str
    department_id: int

class COPOMappingCreate(BaseModel):
    co_id: int
    po_id: int
    strength: float

@app.get("/", response_model=Dict[str, str])
async def root():
    return {"message": "CO/PO Service", "version": "1.0.0", "status": "healthy"}

@app.get("/api/cos")
async def get_cos(
    subject_id: Optional[int] = None,
    department_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get all Course Outcomes with filtering"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    query = db.query(CO).options(
        joinedload(CO.subject),
        joinedload(CO.department)
    )
    
    # Apply role-based filtering
    if current_user.role == "hod":
        query = query.filter(CO.department_id == current_user.department_id)
    elif current_user.role == "teacher":
        # Teachers can only see COs for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if subject_ids:
            query = query.filter(CO.subject_id.in_(subject_ids))
        else:
            query = query.filter(False)  # No access if no subjects assigned
    
    # Apply filters
    if subject_id:
        query = query.filter(CO.subject_id == subject_id)
    if department_id:
        if current_user.role == "admin" or (current_user.role == "hod" and department_id == current_user.department_id):
            query = query.filter(CO.department_id == department_id)
        else:
            raise HTTPException(status_code=403, detail="Access denied to this department")
    
    cos = query.offset(skip).limit(limit).all()
    
    return {"cos": cos}

@app.get("/api/cos/{co_id}")
async def get_co(
    co_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod", "teacher"]))
):
    """Get a specific CO"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    co = db.query(CO).options(
        joinedload(CO.subject),
        joinedload(CO.department)
    ).filter(CO.id == co_id).first()
    
    if not co:
        raise HTTPException(status_code=404, detail="CO not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if co.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "teacher":
        # Teachers can only access COs for subjects they teach
        teacher_subjects = db.query(Subject).filter(Subject.teacher_id == current_user_id).all()
        subject_ids = [subject.id for subject in teacher_subjects]
        if co.subject_id not in subject_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return {"co": co}

@app.post("/api/cos")
async def create_co(
    co_data: COCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(RoleChecker(["admin", "hod"]))
):
    """Create a new Course Outcome"""
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # Validate subject exists
    subject = db.query(Subject).filter(Subject.id == co_data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Role-based access control
    if current_user.role == "hod":
        if subject.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Can only create COs for subjects in your department")
    
    # Create CO
    new_co = CO(
        name=co_data.name,
        description=co_data.description,
        subject_id=co_data.subject_id,
        department_id=subject.department_id,  # Use subject's department
        created_at=datetime.utcnow()
    )
    
    db.add(new_co)
    db.commit()
    db.refresh(new_co)
    
    return {
        "message": "CO created successfully",
        "co_id": new_co.id,
        "co": new_co
    }

@app.put("/api/cos/{co_id}")
async def update_co(co_id: int, co_data: COCreate):
    """Update a CO"""
    return {
        "message": "CO updated successfully",
        "co": {
            "id": co_id,
            "name": co_data.name,
            "description": co_data.description,
            "subject_id": co_data.subject_id,
            "department_id": co_data.department_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    }

@app.delete("/api/cos/{co_id}")
async def delete_co(co_id: int):
    """Delete a CO"""
    return {"message": "CO deleted successfully"}

@app.get("/api/pos")
async def get_pos(department_id: Optional[int] = None):
    """Get all Program Outcomes with filtering"""
    mock_pos = [
        {
            "id": 1,
            "name": "PO1",
            "description": "Engineering knowledge",
            "department_id": 1,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": 2,
            "name": "PO2",
            "description": "Problem analysis",
            "department_id": 1,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    return {"pos": mock_pos}

@app.get("/api/pos/{po_id}")
async def get_po(po_id: int):
    """Get a specific PO"""
    mock_po = {
        "id": po_id,
        "name": f"PO{po_id}",
        "description": f"Program Outcome {po_id} description",
        "department_id": 1,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    return {"po": mock_po}

@app.post("/api/pos")
async def create_po(po_data: POCreate):
    """Create a new Program Outcome"""
    return {
        "message": "PO created successfully",
        "po_id": 1,
        "po": {
            "id": 1,
            "name": po_data.name,
            "description": po_data.description,
            "department_id": po_data.department_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    }

@app.put("/api/pos/{po_id}")
async def update_po(po_id: int, po_data: POCreate):
    """Update a PO"""
    return {
        "message": "PO updated successfully",
        "po": {
            "id": po_id,
            "name": po_data.name,
            "description": po_data.description,
            "department_id": po_data.department_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    }

@app.delete("/api/pos/{po_id}")
async def delete_po(po_id: int):
    """Delete a PO"""
    return {"message": "PO deleted successfully"}

@app.get("/api/copo-mappings")
async def get_copo_mappings(
    co_id: Optional[int] = None,
    po_id: Optional[int] = None,
    department_id: Optional[int] = None
):
    """Get CO-PO mappings with filtering"""
    mock_mappings = [
        {
            "id": 1,
            "co_id": 1,
            "po_id": 1,
            "mapping_strength": 2.5,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "id": 2,
            "co_id": 2,
            "po_id": 2,
            "mapping_strength": 3.0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    return {"mappings": mock_mappings}

@app.post("/api/copo-mappings")
async def create_copo_mapping(mapping_data: COPOMappingCreate):
    """Create a CO-PO mapping"""
    return {
        "message": "CO-PO mapping created successfully",
        "mapping": {
            "id": 1,
            "co_id": mapping_data.co_id,
            "po_id": mapping_data.po_id,
            "mapping_strength": mapping_data.strength,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    }

@app.put("/api/copo-mappings/{mapping_id}")
async def update_copo_mapping(mapping_id: int, mapping_data: COPOMappingCreate):
    """Update a CO-PO mapping"""
    return {
        "message": "CO-PO mapping updated successfully",
        "mapping": {
            "id": mapping_id,
            "co_id": mapping_data.co_id,
            "po_id": mapping_data.po_id,
            "mapping_strength": mapping_data.strength,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    }

@app.delete("/api/copo-mappings/{mapping_id}")
async def delete_copo_mapping(mapping_id: int):
    """Delete a CO-PO mapping"""
    return {"message": "CO-PO mapping deleted successfully"}

@app.get("/api/copo/analytics")
async def get_copo_analytics(
    department_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    class_id: Optional[int] = None,
    exam_id: Optional[int] = None
):
    """Get comprehensive CO/PO analytics with attainment calculations"""
    mock_analytics = {
        "total_cos": 10,
        "total_pos": 8,
        "total_mappings": 25,
        "co_attainment": [
            {
                "co_id": 1,
                "co_name": "CO1",
                "attainment_percentage": 85.5,
                "total_questions": 5,
                "total_marks": 25
            },
            {
                "co_id": 2,
                "co_name": "CO2",
                "attainment_percentage": 78.2,
                "total_questions": 4,
                "total_marks": 20
            }
        ],
        "po_attainment": [
            {
                "po_id": 1,
                "po_name": "PO1",
                "attainment_percentage": 82.1,
                "mapped_cos": 3,
                "total_weight": 7.5
            },
            {
                "po_id": 2,
                "po_name": "PO2",
                "attainment_percentage": 79.8,
                "mapped_cos": 2,
                "total_weight": 5.0
            }
        ],
        "mapping_strength_distribution": {
            "strong": 15,
            "moderate": 8,
            "weak": 2
        },
        "coverage_analysis": {
            "cos_with_mappings": 8,
            "pos_with_mappings": 6,
            "unmapped_cos": 2,
            "unmapped_pos": 2
        }
    }
    
    if department_id:
        mock_analytics["department_id"] = department_id
    
    if subject_id:
        mock_analytics["subject_id"] = subject_id
    
    if class_id:
        mock_analytics["class_id"] = class_id
    
    if exam_id:
        mock_analytics["exam_id"] = exam_id
    
    return {"analytics": mock_analytics}

@app.get("/api/copo/recommendations")
async def get_copo_recommendations(department_id: int):
    """Get smart CO/PO mapping recommendations"""
    mock_recommendations = [
        {
            "co_id": 3,
            "co_name": "CO3",
            "subject_name": "Data Structures",
            "potential_mappings": [
                {
                    "po_id": 3,
                    "po_name": "PO3",
                    "similarity_score": 0.75,
                    "suggested_strength": 2.25
                },
                {
                    "po_id": 4,
                    "po_name": "PO4",
                    "similarity_score": 0.60,
                    "suggested_strength": 1.80
                }
            ]
        }
    ]
    
    return {
        "recommendations": mock_recommendations,
        "department_id": department_id,
        "total_recommendations": len(mock_recommendations)
    }

@app.post("/api/cos/smart")
async def create_smart_co(co_data: COCreate):
    """Create a smart CO with AI recommendations"""
    return {
        "message": "Smart CO created successfully",
        "co_id": 1,
        "recommendations": [
            {
                "po_id": 1,
                "po_name": "PO1",
                "suggested_mapping_strength": 2.5,
                "reason": "High keyword similarity"
            }
        ]
    }

@app.post("/api/pos/smart")
async def create_smart_po(po_data: POCreate):
    """Create a smart PO with AI recommendations"""
    return {
        "message": "Smart PO created successfully",
        "po_id": 1,
        "recommendations": [
            {
                "co_id": 1,
                "co_name": "CO1",
                "suggested_mapping_strength": 2.5,
                "reason": "High keyword similarity"
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8026)
