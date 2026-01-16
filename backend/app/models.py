from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    REJECTED = "rejected"

class TransactionType(str, enum.Enum):
    INCOME = "income"  # Ingreso
    EXPENSE = "expense"  # Egreso

class Category(str, enum.Enum):
    # Egresos
    SERVICIOS_BASICOS = "Servicios Basicos"
    MERCADO = "Mercado"  # También "Alimentos" en Excel
    VIVIENDA = "Vivienda"
    TRANSPORTE = "Transporte"  # También "Combustible" en Excel
    IMPUESTOS = "Impuestos"
    EDUCACION = "Educacion"
    SALUD = "Salud"
    SALUD_MEDICAMENTOS = "Salud Medicamentos"  # Categoría específica del Excel
    VIDA_SOCIAL = "Vida Social"
    AGUINALDO_VACACIONES = "Aguinaldo y Vacaciones"  # Nueva categoría del Excel
    # Ingresos
    INCOME = "Income"  # Categoría principal de ingresos del Excel
    MAIN_INCOME = "Main Income"  # Ingreso principal
    SIDE_INCOME = "Side Income"  # Ingreso secundario
    SALARIO = "Salario"
    BONOS = "Bonos"
    RENTAS = "Rentas"
    REEMBOLSOS = "Reembolsos"
    INVERSIONES = "Inversiones"
    OTROS_INGRESOS = "Otros Ingresos"

class Subcategory(str, enum.Enum):
    # Servicios Basicos
    ELECTRICIDAD_CFE = "Electricidad CFE"
    AGUA_POTABLE = "Agua Potable"
    GAS_LP = "Gas LP"
    INTERNET = "Internet"
    ENTRETENIMIENTO = "Entretenimiento"
    GARRAFONES_AGUA = "Garrafones Agua"
    TELCEL = "Telcel"
    TELCEL_PLAN_FAMILIAR = "Telcel Plan Familiar"
    MANTENIMIENTO_HOGAR = "Mantenimiento Hogar"
    SUELDO_LIMPIEZA_MARI = "Sueldo Limpieza Mari"
    # Mercado (Alimentos)
    MERCADO_GENERAL = "Mercado General"
    EXTRAS_DIVERSOS = "Extras Diversos"
    # Vivienda
    CUOTAS_OLINALA = "Cuotas Olinala"
    SEGURO_VIVIENDA = "Seguro Vivienda"
    MEJORAS_REMODELACIONES = "Mejoras y Remodelaciones"
    # Transporte (Combustible)
    GASOLINA = "Gasolina"
    MANTENIMIENTO_COCHES = "Mantenimiento coches"
    SEGUROS_Y_DERECHOS = "Seguros y Derechos"
    LAVADO = "Lavado"
    # Vehículos específicos (para Combustible)
    LX600 = "LX600"
    BMW = "BMW"
    HONDA_CIVIC = "HONDA CIVIC"
    LAND_CRUISER = "LAND CRUISER"
    # Impuestos
    PREDIAL = "Predial"
    # Educacion (por persona)
    COLEGIATURAS = "Colegiaturas"
    GONZALO = "Gonzalo"
    SEBASTIAN = "Sebastian"
    EMILIANO = "Emiliano"
    ISABELA = "Isabela"
    SANTIAGO = "Santiago"
    ENRIQUE = "Enrique"
    # Salud
    CONSULTA = "Consulta"
    MEDICAMENTOS = "Medicamentos"
    SEGURO_MEDICO = "Seguro Medico"
    PREVENCION = "Prevencion"
    # Salud Medicamentos (específicos por persona)
    GONZALO_JR_VUMINIX_MEDIKINET = "Gonzalo Jr Vuminix, Medikinet"
    ISABELA_LUVOX_RISPERDAL = "Isabela Luvox, Risperdal"
    GONZALO_MF_LEXAPRO_CONCERTA_EFEXXOR = "Gonzalo MF, Lexapro, Concerta, Efexxor"
    SEBASTIAN_MB_CONCERTA = "Sebastian MB, Concerta"
    EMILIANO_MB_CONCERTA_VUMINIX = "Emiliano MB, Concerta, Vuminix"
    # Vida Social
    SALIDAS_PERSONALES = "Salidas Personales"
    SALIDAS_FAMILIARES = "Salidas Familiares"
    CUMPLEANOS = "Cumpleanos"
    ANIVERSARIOS = "Aniversarios"
    REGALOS_NAVIDAD = "Regalos Navidad"
    # Vida Social (específicas por persona)
    SALIDAS_GONZALO = "Salidas Gonzalo"
    SALIDAS_EMILIANO = "Salidas Emiliano"
    SALIDAS_SEBASTIAN = "Salidas Sebastian"
    SEMANA_ISABELA = "Semana Isabela"
    SEMANA_SANTIAGO = "Semana Santiago"
    # Aguinaldo y Vacaciones
    MARI_DE_JESUS = "Mari de jesus"
    # Ingresos - Salario
    SALARIO_FIJO = "Salario Fijo"
    SALARIO_VARIABLE = "Salario Variable"
    # Ingresos - Bonos
    BONO_ANUAL = "Bono Anual"
    BONO_QUINCENAL = "Bono Quincenal"
    BONO_EXTRA = "Bono Extra"
    # Ingresos - Rentas
    RENTA_PROPiedades = "Renta Propiedades"
    RENTA_INVERSIONES = "Renta Inversiones"
    # Ingresos - Reembolsos
    REEMBOLSO_GASTOS = "Reembolso Gastos"
    REEMBOLSO_IMPUESTOS = "Reembolso Impuestos"
    # Ingresos - Inversiones
    DIVIDENDOS = "Dividendos"
    INTERESES = "Intereses"
    GANANCIAS_CAPITAL = "Ganancias Capital"
    # Ingresos - Otros
    REGALOS = "Regalos"
    PREMIOS = "Premios"
    OTROS = "Otros"

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
    
    family = relationship("Family", back_populates="members", foreign_keys="User.family_id")
    budgets = relationship("UserBudget", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    receipts = relationship("Receipt", back_populates="user")

class Family(Base):
    __tablename__ = "families"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    members = relationship("User", back_populates="family", foreign_keys="User.family_id")
    budgets = relationship("FamilyBudget", back_populates="family")
    custom_categories = relationship("CustomCategory", back_populates="family", cascade="all, delete-orphan")

class BudgetType(str, enum.Enum):
    SHARED = "shared"  # Presupuesto común compartido por la familia
    INDIVIDUAL = "individual"  # Presupuesto individual por miembro

class DistributionMethod(str, enum.Enum):
    EQUAL = "equal"  # Distribución equitativa entre todos
    PERCENTAGE = "percentage"  # Distribución por porcentaje definido
    MANUAL = "manual"  # Distribución manual por el admin

class CustomCategory(Base):
    """
    Categorías personalizadas creadas por los usuarios.
    Permite crear nuevas cuentas/categorías más allá de las predefinidas.
    """
    __tablename__ = "custom_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    name = Column(String, nullable=False)  # Nombre de la categoría personalizada
    description = Column(Text, nullable=True)  # Descripción opcional
    icon = Column(String, nullable=True)  # Icono opcional (emoji o nombre)
    color = Column(String, nullable=True)  # Color opcional para visualización
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    family = relationship("Family", back_populates="custom_categories")
    subcategories = relationship("CustomSubcategory", back_populates="custom_category", cascade="all, delete-orphan")

class CustomSubcategory(Base):
    """
    Subcategorías personalizadas asociadas a categorías personalizadas.
    """
    __tablename__ = "custom_subcategories"
    
    id = Column(Integer, primary_key=True, index=True)
    custom_category_id = Column(Integer, ForeignKey("custom_categories.id"), nullable=False)
    name = Column(String, nullable=False)  # Nombre de la subcategoría
    description = Column(Text, nullable=True)  # Descripción opcional
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    custom_category = relationship("CustomCategory", back_populates="subcategories")

class FamilyBudget(Base):
    __tablename__ = "family_budgets"
    
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=False)
    category = Column(SQLEnum(Category), nullable=True)  # Cambiado a nullable para permitir categorías personalizadas
    subcategory = Column(SQLEnum(Subcategory), nullable=True)  # Cambiado a nullable
    custom_category_id = Column(Integer, ForeignKey("custom_categories.id"), nullable=True)  # Nueva: categoría personalizada
    custom_subcategory_id = Column(Integer, ForeignKey("custom_subcategories.id"), nullable=True)  # Nueva: subcategoría personalizada
    year = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)
    monthly_amounts = Column(JSON, nullable=True)  # Montos mensuales: {"JANUARY": 1000, "FEBRUARY": 2000, ...}
    display_names = Column(JSON, nullable=True)  # Nombres de visualización personalizados: {"category": "Nombre Personalizado", "subcategory": "Nombre Personalizado"}
    due_date = Column(DateTime(timezone=True), nullable=True)  # Fecha de vencimiento o fecha límite de pago
    payment_status = Column(String(20), default="pending", nullable=True)  # Estado de pago: pending, partial, paid, overdue
    notes = Column(Text, nullable=True)  # Notas adicionales sobre el presupuesto
    budget_type = Column(String(20), default=BudgetType.SHARED.value, nullable=False)  # Tipo de presupuesto
    distribution_method = Column(String(20), default=DistributionMethod.EQUAL.value, nullable=False)  # Método de distribución
    auto_distribute = Column(Boolean, default=True, nullable=False)  # Si se distribuye automáticamente
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Para presupuestos individuales
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    family = relationship("Family", back_populates="budgets")
    user_allocations = relationship("UserBudget", back_populates="family_budget")
    target_user = relationship("User", foreign_keys=[target_user_id])
    custom_category = relationship("CustomCategory", foreign_keys=[custom_category_id])
    custom_subcategory = relationship("CustomSubcategory", foreign_keys=[custom_subcategory_id])

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
    transaction_type = Column(String(20), default=TransactionType.EXPENSE.value, nullable=False)  # Tipo: ingreso o egreso
    currency = Column(String, default="MXN")
    merchant_or_beneficiary = Column(String, nullable=True)
    category = Column(SQLEnum(Category), nullable=True)  # Cambiado a nullable para permitir categorías personalizadas
    subcategory = Column(SQLEnum(Subcategory), nullable=True)  # Cambiado a nullable
    custom_category_id = Column(Integer, ForeignKey("custom_categories.id"), nullable=True)  # Nueva: categoría personalizada
    custom_subcategory_id = Column(Integer, ForeignKey("custom_subcategories.id"), nullable=True)  # Nueva: subcategoría personalizada
    concept = Column(String, nullable=True)
    reference = Column(String, nullable=True)
    operation_id = Column(String, nullable=True)
    tracking_key = Column(String, nullable=True)
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING)
    notes = Column(Text, nullable=True)
    receipt_image_url = Column(String, nullable=True)
    whatsapp_message_id = Column(String, nullable=True)
    whatsapp_phone = Column(String, nullable=True)  # Número de teléfono desde donde se envió el mensaje de WhatsApp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="transactions")

class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_url = Column(String, nullable=True)  # URL de la imagen del recibo
    whatsapp_message_id = Column(String, nullable=True)  # ID del mensaje de WhatsApp si vino por WhatsApp
    whatsapp_phone = Column(String, nullable=True)  # Número de teléfono desde donde se envió
    
    # Datos extraídos del recibo
    date = Column(String, nullable=True)  # YYYY-MM-DD
    time = Column(String, nullable=True)  # HH:MM
    amount = Column(Float, nullable=False)
    currency = Column(String, default="MXN")
    merchant_or_beneficiary = Column(String, nullable=True)
    category = Column(SQLEnum(Category), nullable=True)
    subcategory = Column(SQLEnum(Subcategory), nullable=True)
    concept = Column(String, nullable=True)
    reference = Column(String, nullable=True)
    operation_id = Column(String, nullable=True)
    tracking_key = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Estado del recibo
    status = Column(String, default="pending")  # pending, assigned, processed
    assigned_transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)  # Transacción asignada
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="receipts")
    assigned_transaction = relationship("Transaction", foreign_keys=[assigned_transaction_id])
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")

class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    
    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)
    description = Column(String, nullable=False)  # Descripción del concepto
    amount = Column(Float, nullable=False)  # Monto total del concepto
    quantity = Column(Float, nullable=True)  # Cantidad del producto
    unit_price = Column(Float, nullable=True)  # Precio unitario del producto
    unit_of_measure = Column(String, nullable=True)  # Unidad de medida (kg, litros, piezas, etc.)
    category = Column(SQLEnum(Category), nullable=True)
    subcategory = Column(SQLEnum(Subcategory), nullable=True)
    assigned_transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)  # Transacción asignada
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    receipt = relationship("Receipt", back_populates="items")
    assigned_transaction = relationship("Transaction", foreign_keys=[assigned_transaction_id])

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Usuario que realizó la acción
    action_type = Column(String(50), nullable=False)  # Tipo de acción: 'budget_created', 'budget_updated', 'transaction_created', etc.
    entity_type = Column(String(50), nullable=False)  # Tipo de entidad: 'budget', 'transaction', 'user', etc.
    entity_id = Column(Integer, nullable=True)  # ID de la entidad afectada
    description = Column(Text, nullable=False)  # Descripción de la acción
    details = Column(JSON, nullable=True)  # Detalles adicionales en formato JSON
    ip_address = Column(String(50), nullable=True)  # Dirección IP del usuario
    user_agent = Column(String(500), nullable=True)  # User agent del navegador
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", foreign_keys=[user_id])
