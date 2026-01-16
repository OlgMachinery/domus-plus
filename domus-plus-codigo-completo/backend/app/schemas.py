from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from app.models import Category, Subcategory, TransactionStatus

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    phone: str
    name: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_family_admin: bool
    family_id: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Family Schemas
class FamilyBase(BaseModel):
    name: str

class FamilyCreate(FamilyBase):
    pass

class FamilyResponse(FamilyBase):
    id: int
    admin_id: int
    created_at: datetime
    members: List[UserResponse] = []
    
    class Config:
        from_attributes = True

# Budget Schemas
class FamilyBudgetBase(BaseModel):
    category: Category
    subcategory: Subcategory
    year: int
    total_amount: float

class FamilyBudgetCreate(FamilyBudgetBase):
    pass

class FamilyBudgetResponse(FamilyBudgetBase):
    id: int
    family_id: int
    created_at: datetime
    user_allocations: Optional[List["UserBudgetResponse"]] = []
    
    class Config:
        from_attributes = True

class UserBudgetBase(BaseModel):
    user_id: int
    allocated_amount: float

class UserBudgetCreate(UserBudgetBase):
    family_budget_id: int

class UserBudgetResponse(UserBudgetBase):
    id: int
    family_budget_id: int
    spent_amount: float
    created_at: datetime
    user: Optional[UserResponse] = None
    family_budget: Optional[FamilyBudgetResponse] = None
    
    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionBase(BaseModel):
    date: datetime
    amount: float
    currency: str = "MXN"
    merchant_or_beneficiary: Optional[str] = None
    category: Category
    subcategory: Subcategory
    concept: Optional[str] = None
    reference: Optional[str] = None
    operation_id: Optional[str] = None
    tracking_key: Optional[str] = None
    notes: Optional[str] = None

class TransactionCreate(TransactionBase):
    family_budget_id: Optional[int] = None

class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    family_budget_id: Optional[int]
    status: TransactionStatus
    receipt_image_url: Optional[str] = None
    whatsapp_message_id: Optional[str] = None
    created_at: datetime
    user: UserResponse
    
    class Config:
        from_attributes = True

# Receipt Processing
class ReceiptData(BaseModel):
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    amount: float
    currency: str = "MXN"
    merchant_or_beneficiary: Optional[str] = None
    category: Category
    subcategory: Subcategory
    concept: Optional[str] = None
    reference: Optional[str] = None
    operation_id: Optional[str] = None
    tracking_key: Optional[str] = None
    status: str = "processed"
    notes: Optional[str] = None

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

