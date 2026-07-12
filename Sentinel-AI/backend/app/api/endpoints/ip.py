from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.ip_reputation import IPReputation
from app.schemas.responses import IPReputationSchema

router = APIRouter()

@router.get("/{address}", response_model=IPReputationSchema)
def get_ip_reputation(address: str, db: Session = Depends(get_db)):
    """Fetch detailed reputation tracking for a specific IP address."""
    ip_rep = db.query(IPReputation).filter(IPReputation.ip_address == address).first()
    
    if not ip_rep:
        raise HTTPException(status_code=404, detail="IP address not found in reputation tracker.")
        
    return ip_rep
