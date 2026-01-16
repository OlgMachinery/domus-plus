from pydantic import BaseModel, EmailStr, field_validator, model_validator
from datetime import datetime
from typing import Optional, List, Union, Dict, Any
from app.models import Category, Subcategory, TransactionStatus, TransactionType, BudgetType, DistributionMethod

# Schemas para categorías personalizadas
class CustomSubcategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CustomSubcategoryCreate(CustomSubcategoryBase):
    pass

class CustomSubcategoryResponse(CustomSubcategoryBase):
    id: int
    custom_category_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class CustomCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None

class CustomCategoryCreate(CustomCategoryBase):
    subcategories: Optional[List[CustomSubcategoryCreate]] = []

class CustomCategoryUpdate(CustomCategoryBase):
    is_active: Optional[bool] = None

class CustomCategoryResponse(CustomCategoryBase):
    id: int
    family_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    subcategories: List[CustomSubcategoryResponse] = []
    
    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    phone: str
    name: str
    is_active: bool = True
    is_family_admin: bool = False
    family_id: Optional[int]

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
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
    category: Optional[Category] = None  # Categoría predefinida (opcional si se usa custom_category_id)
    subcategory: Optional[Subcategory] = None  # Subcategoría predefinida (opcional si se usa custom_subcategory_id)
    custom_category_id: Optional[int] = None  # ID de categoría personalizada (opcional si se usa category)
    custom_subcategory_id: Optional[int] = None  # ID de subcategoría personalizada (opcional si se usa subcategory)
    year: int
    total_amount: float
    monthly_amounts: Optional[dict] = None  # Montos mensuales: {"JANUARY": 1000, "FEBRUARY": 2000, ...}
    budget_type: BudgetType = BudgetType.SHARED
    distribution_method: DistributionMethod = DistributionMethod.EQUAL
    auto_distribute: bool = True
    target_user_id: Optional[int] = None  # Para presupuestos individuales
    
    @model_validator(mode='after')
    def validate_category_combination(self):
        """Valida que se proporcione category+subcategory O custom_category_id+custom_subcategory_id"""
        has_predefined = self.category is not None and self.subcategory is not None
        has_custom = self.custom_category_id is not None and self.custom_subcategory_id is not None
        
        if not has_predefined and not has_custom:
            raise ValueError('Debe proporcionar category+subcategory O custom_category_id+custom_subcategory_id')
        if has_predefined and has_custom:
            raise ValueError('No puede proporcionar categorías predefinidas y personalizadas al mismo tiempo')
        
        return self

class FamilyBudgetCreate(FamilyBudgetBase):
    pass

class FamilyBudgetUpdate(BaseModel):
    total_amount: Optional[float] = None
    monthly_amounts: Optional[dict] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    payment_status: Optional[str] = None

class FamilyBudgetUpdate(BaseModel):
    total_amount: Optional[float] = None
    monthly_amounts: Optional[dict] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    payment_status: Optional[str] = None

class FamilyBudgetResponse(FamilyBudgetBase):
    id: int
    family_id: int
    display_names: Optional[dict] = None
    due_date: Optional[datetime] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_allocations: List['UserBudgetResponse'] = []
    target_user: Optional[UserResponse] = None
    custom_category: Optional[CustomCategoryResponse] = None
    custom_subcategory: Optional[CustomSubcategoryResponse] = None
    
    class Config:
        from_attributes = True

# UserBudget Schemas
class UserBudgetBase(BaseModel):
    allocated_amount: float
    spent_amount: float = 0.0
    income_amount: float = 0.0

class UserBudgetCreate(BaseModel):
    family_budget_id: int
    user_id: int
    allocated_amount: float

class UserBudgetResponse(UserBudgetBase):
    id: int
    user_id: int
    family_budget_id: int
    available_amount: float
    created_at: datetime
    user: Optional[UserResponse] = None
    # No incluir family_budget aquí para evitar recursión circular
    # Si necesitas el presupuesto, haz una llamada separada
    
    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionBase(BaseModel):
    date: datetime
    amount: float
    currency: str = "MXN"
    transaction_type: TransactionType
    merchant_or_beneficiary: Optional[str] = None
    category: Category
    subcategory: Subcategory
    concept: Optional[str] = None
    reference: Optional[str] = None
    operation_id: Optional[str] = None
    tracking_key: Optional[str] = None
    notes: Optional[str] = None
    family_budget_id: Optional[int] = None
    user_id: Optional[int] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    date: Optional[datetime] = None
    concept: Optional[str] = None
    merchant_or_beneficiary: Optional[str] = None
    category: Optional[Category] = None
    subcategory: Optional[Subcategory] = None
    transaction_type: Optional[TransactionType] = None
    user_id: Optional[int] = None
    family_budget_id: Optional[int] = None

class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    status: TransactionStatus
    receipt_image_url: Optional[str] = None
    whatsapp_message_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    user: Optional[UserResponse] = None
    
    @field_validator('transaction_type', mode='before')
    @classmethod
    def convert_transaction_type(cls, v):
        if isinstance(v, str):
            if v.lower() == 'income':
                return TransactionType.INCOME
            elif v.lower() == 'expense':
                return TransactionType.EXPENSE
        return v
    
    class Config:
        from_attributes = True

# Receipt Processing
class ReceiptItemData(BaseModel):
    description: str
    amount: float
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    unit_of_measure: Optional[str] = None
    category: Optional[Category] = None
    subcategory: Optional[Subcategory] = None

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
    items: Optional[List[ReceiptItemData]] = None  # Lista de conceptos/items del recibo

# Receipt Schemas
class ReceiptItemBase(BaseModel):
    description: str
    amount: float
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    unit_of_measure: Optional[str] = None
    category: Optional[Category] = None
    subcategory: Optional[Subcategory] = None
    notes: Optional[str] = None

class ReceiptItemCreate(ReceiptItemBase):
    pass

class ReceiptItemResponse(ReceiptItemBase):
    id: int
    receipt_id: int
    assigned_transaction_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReceiptBase(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    amount: float
    currency: str = "MXN"
    merchant_or_beneficiary: Optional[str] = None
    category: Optional[Category] = None
    subcategory: Optional[Subcategory] = None
    concept: Optional[str] = None
    reference: Optional[str] = None
    operation_id: Optional[str] = None
    tracking_key: Optional[str] = None
    notes: Optional[str] = None
    status: str = "pending"

class ReceiptCreate(ReceiptBase):
    image_url: Optional[str] = None
    whatsapp_message_id: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    items: Optional[List[ReceiptItemCreate]] = None

class ReceiptResponse(ReceiptBase):
    id: int
    user_id: int
    image_url: Optional[str] = None
    whatsapp_message_id: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    assigned_transaction_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[ReceiptItemResponse] = []
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True

class ReceiptAssignRequest(BaseModel):
    transaction_id: Optional[int] = None  # Si es None, se crea una nueva transacción
    items: Optional[List[Dict[str, Any]]] = None  # Lista de items con transaction_id asignado
    family_budget_id: int  # ID del presupuesto familiar (OBLIGATORIO)
    target_user_id: Optional[int] = None  # Usuario asignado (None = todos los usuarios)
    percentage: Optional[float] = None  # Porcentaje (0-100), si es None significa 100%
    user_percentages: Optional[Dict[int, float]] = None  # Porcentajes por usuario {user_id: percentage}
    assign_to_all: Optional[bool] = False  # Si es True, asigna a todos los usuarios

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Activity Log Schemas
class ActivityLogBase(BaseModel):
    action_type: str
    entity_type: str
    entity_id: Optional[int] = None
    description: str
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class ActivityLogCreate(ActivityLogBase):
    user_id: Optional[int] = None

class ActivityLogResponse(ActivityLogBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True
