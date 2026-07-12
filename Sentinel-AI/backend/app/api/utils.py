from typing import Type, TypeVar, List
from sqlalchemy.orm import Session
from sqlalchemy import func
import math

T = TypeVar("T")

def paginate(db: Session, query, page: int, size: int) -> dict:
    if page < 1:
        page = 1
    if size < 1:
        size = 10
    if size > 100:
        size = 100
        
    total = query.count()
    pages = math.ceil(total / size) if total > 0 else 0
    items = query.offset((page - 1) * size).limit(size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }
