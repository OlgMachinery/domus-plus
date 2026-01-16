from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    REJECTED = "rejected"

class Category(str, enum.Enum):
    SERVICIOS_BASICOS = "Servicios Basicos"
    MERCADO = "Mercado"
    VIVIENDA = "Vivienda"
    TRANSPORTE = "Transporte"
    IMPUESTOS = "Impuestos"
    EDUCACION = "Educacion"
    SALUD = "Salud"
    VIDA_SOCIAL = "Vida Social"

class Subcategory(str, enum.Enum):
    # Servicios Basicos
    ELECTRICIDAD_CFE = "Electricidad CFE"
    AGUA_POTABLE = "Agua Potable"
    GAS_LP = "Gas LP"
    INTERNET = "Internet"
    ENTRETENIMIENTO = "Entretenimiento"
    GARRAFONES_AGUA = "Garrafones Agua"
    TELCEL = "Telcel"
    # Mercado
    MERCADO_GENERAL = "Mercado General"
    # Vivienda
    CUOTAS_OLINALA = "Cuotas Olinala"
    SEGURO_VIVIENDA = "Seguro Vivienda"
    MEJORAS_REMODELACIONES = "Mejoras y Remodelaciones"
    # Transporte
    GASOLINA = "Gasolina"
    MANTENIMIENTO_COCHES = "Mantenimiento coches"
    SEGUROS_Y_DERECHOS = "Seguros y Derechos"
    LAVADO = "Lavado"
    # Impuestos
    PREDIAL = "Predial"
    # Educacion
    COLEGIATURAS = "Colegiaturas"
    # Salud
    CONSULTA = "Consulta"
    MEDICAMENTOS = "Medicamentos"
    SEGURO_MEDICO = "Seguro Medico"
    PREVENCION = "Prevencion"
    # Vida Social
    SALIDAS_PERSONALES = "Salidas Personales"
    SALIDAS_FAMILIARES = "Salidas Familiares"
    CUMPLEANOS = "Cumpleanos"
    ANIVERSARIOS = "Aniversarios"
    REGALOS_NAVIDAD = "Regalos Navidad"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)  # WhatsApp number
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_family_admin = Column(Boolean, default=False)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    family = relationship("Family", back_populates="members")
    budgets = relationship("UserBudget", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")

class Family(Base):
    __tablename__ = "families"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    members = relationship("User", back_populates="family")
    budgets = relationship("FamilyBudget", back_populates="family")

class FamilyBudget(Base):
    __tablename__ = "family_budgets"
    
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    category = Column(SQLEnum(Category), nullable=False)
    subcategory = Column(SQLEnum(Subcategory), nullable=False)
    year = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    family = relationship("Family", back_populates="budgets")
    user_allocations = relationship("UserBudget", back_populates="family_budget")

class UserBudget(Base):
    __tablename__ = "user_budgets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    family_budget_id = Column(Integer, ForeignKey("family_budgets.id"), nullable=False)
    allocated_amount = Column(Float, nullable=False)
    spent_amount = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="budgets")
    family_budget = relationship("FamilyBudget", back_populates="user_allocations")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    family_budget_id = Column(Integer, ForeignKey("family_budgets.id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="MXN")
    merchant_or_beneficiary = Column(String, nullable=True)
    category = Column(SQLEnum(Category), nullable=False)
    subcategory = Column(SQLEnum(Subcategory), nullable=False)
    concept = Column(String, nullable=True)
    reference = Column(String, nullable=True)
    operation_id = Column(String, nullable=True)
    tracking_key = Column(String, nullable=True)
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING)
    notes = Column(Text, nullable=True)
    receipt_image_url = Column(String, nullable=True)
    whatsapp_message_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="transactions")

