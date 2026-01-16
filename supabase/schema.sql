-- Esquema de base de datos para DOMUS+ en Supabase
-- Migrado desde SQLAlchemy models

-- Extensión para UUIDs si es necesario
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios (extiende auth.users de Supabase)
-- Debe crearse primero porque families la referencia
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR UNIQUE NOT NULL,
    phone VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_family_admin BOOLEAN DEFAULT FALSE,
    family_id INTEGER, -- Se actualizará después de crear families
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de familias
CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ahora actualizar la foreign key de users.family_id
ALTER TABLE users ADD CONSTRAINT users_family_id_fkey 
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;

-- Enums
CREATE TYPE transaction_status AS ENUM ('pending', 'processed', 'rejected');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE budget_type AS ENUM ('shared', 'individual');
CREATE TYPE distribution_method AS ENUM ('equal', 'percentage', 'manual');

-- Categorías personalizadas
CREATE TABLE IF NOT EXISTS custom_categories (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    icon VARCHAR,
    color VARCHAR,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subcategorías personalizadas
CREATE TABLE IF NOT EXISTS custom_subcategories (
    id SERIAL PRIMARY KEY,
    custom_category_id INTEGER NOT NULL REFERENCES custom_categories(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presupuestos familiares
CREATE TABLE IF NOT EXISTS family_budgets (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    category VARCHAR,
    subcategory VARCHAR,
    custom_category_id INTEGER REFERENCES custom_categories(id) ON DELETE SET NULL,
    custom_subcategory_id INTEGER REFERENCES custom_subcategories(id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    total_amount FLOAT NOT NULL,
    monthly_amounts JSONB,
    display_names JSONB,
    due_date TIMESTAMPTZ,
    payment_status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    budget_type VARCHAR(20) DEFAULT 'shared' NOT NULL,
    distribution_method VARCHAR(20) DEFAULT 'equal' NOT NULL,
    auto_distribute BOOLEAN DEFAULT TRUE NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Presupuestos de usuario
CREATE TABLE IF NOT EXISTS user_budgets (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_budget_id INTEGER NOT NULL REFERENCES family_budgets(id) ON DELETE CASCADE,
    allocated_amount FLOAT NOT NULL,
    spent_amount FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transacciones
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_budget_id INTEGER REFERENCES family_budgets(id) ON DELETE SET NULL,
    date TIMESTAMPTZ NOT NULL,
    amount FLOAT NOT NULL,
    transaction_type VARCHAR(20) DEFAULT 'expense' NOT NULL,
    currency VARCHAR DEFAULT 'MXN',
    merchant_or_beneficiary VARCHAR,
    category VARCHAR,
    subcategory VARCHAR,
    custom_category_id INTEGER REFERENCES custom_categories(id) ON DELETE SET NULL,
    custom_subcategory_id INTEGER REFERENCES custom_subcategories(id) ON DELETE SET NULL,
    concept VARCHAR,
    reference VARCHAR,
    operation_id VARCHAR,
    tracking_key VARCHAR,
    status transaction_status DEFAULT 'pending',
    notes TEXT,
    receipt_image_url VARCHAR,
    whatsapp_message_id VARCHAR,
    whatsapp_phone VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recibos
CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR,
    whatsapp_message_id VARCHAR,
    whatsapp_phone VARCHAR,
    date VARCHAR,
    time VARCHAR,
    amount FLOAT NOT NULL,
    currency VARCHAR DEFAULT 'MXN',
    merchant_or_beneficiary VARCHAR,
    category VARCHAR,
    subcategory VARCHAR,
    concept VARCHAR,
    reference VARCHAR,
    operation_id VARCHAR,
    tracking_key VARCHAR,
    notes TEXT,
    status VARCHAR DEFAULT 'pending',
    assigned_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de recibos
CREATE TABLE IF NOT EXISTS receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    description VARCHAR NOT NULL,
    amount FLOAT NOT NULL,
    quantity FLOAT,
    unit_price FLOAT,
    unit_of_measure VARCHAR,
    category VARCHAR,
    subcategory VARCHAR,
    assigned_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de actividad
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    description TEXT NOT NULL,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_family_budgets_family_id ON family_budgets(family_id);
CREATE INDEX IF NOT EXISTS idx_user_budgets_user_id ON user_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver/editar sus propios datos
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Política: Los usuarios pueden ver datos de su familia
CREATE POLICY "Users can view family data" ON families
    FOR SELECT USING (
        id IN (SELECT family_id FROM users WHERE id = auth.uid())
    );

-- Política: Los usuarios pueden ver presupuestos de su familia
CREATE POLICY "Users can view family budgets" ON family_budgets
    FOR SELECT USING (
        family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
    );

-- Política: Los usuarios pueden ver sus propios presupuestos
CREATE POLICY "Users can view own user budgets" ON user_budgets
    FOR SELECT USING (user_id = auth.uid());

-- Política: Los usuarios pueden ver sus propias transacciones
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (user_id = auth.uid());

-- Política: Los usuarios pueden ver sus propios recibos
CREATE POLICY "Users can view own receipts" ON receipts
    FOR SELECT USING (user_id = auth.uid());

-- Política: Los usuarios pueden ver items de sus recibos
CREATE POLICY "Users can view own receipt items" ON receipt_items
    FOR SELECT USING (
        receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
    );

-- Política: Los usuarios pueden ver categorías personalizadas de su familia
CREATE POLICY "Users can view family custom categories" ON custom_categories
    FOR SELECT USING (
        family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
    );

-- Política: Los usuarios pueden ver logs de su familia
CREATE POLICY "Users can view family activity logs" ON activity_logs
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM users 
            WHERE family_id = (SELECT family_id FROM users WHERE id = auth.uid())
        )
    );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_budgets_updated_at BEFORE UPDATE ON family_budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_budgets_updated_at BEFORE UPDATE ON user_budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_categories_updated_at BEFORE UPDATE ON custom_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_subcategories_updated_at BEFORE UPDATE ON custom_subcategories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
