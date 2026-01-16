"""
Script de migración para agregar campos adicionales a family_budgets:
- due_date: Fecha de vencimiento
- payment_status: Estado de pago
- notes: Notas adicionales
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./domus_plus.db")

def run_migration():
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    print("🚀 Iniciando migración: agregar campos adicionales a family_budgets")
    
    with SessionLocal() as db:
        try:
            inspector = inspect(engine)
            if 'family_budgets' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('family_budgets')]
                
                with engine.connect() as connection:
                    if DATABASE_URL.startswith("sqlite"):
                        # SQLite
                        if 'due_date' not in columns:
                            print("🔄 Agregando columna due_date...")
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN due_date DATETIME"))
                            connection.commit()
                            print("✅ Columna due_date agregada")
                        
                        if 'payment_status' not in columns:
                            print("🔄 Agregando columna payment_status...")
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN payment_status VARCHAR(20)"))
                            connection.commit()
                            print("✅ Columna payment_status agregada")
                        
                        if 'notes' not in columns:
                            print("🔄 Agregando columna notes...")
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN notes TEXT"))
                            connection.commit()
                            print("✅ Columna notes agregada")
                    else:
                        # PostgreSQL
                        if 'due_date' not in columns:
                            print("🔄 Agregando columna due_date...")
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN due_date TIMESTAMP WITH TIME ZONE"))
                            connection.commit()
                            print("✅ Columna due_date agregada")
                        
                        if 'payment_status' not in columns:
                            print("🔄 Agregando columna payment_status...")
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN payment_status VARCHAR(20)"))
                            connection.commit()
                            print("✅ Columna payment_status agregada")
                        
                        if 'notes' not in columns:
                            print("🔄 Agregando columna notes...")
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN notes TEXT"))
                            connection.commit()
                            print("✅ Columna notes agregada")
                
                # Verificar
                columns_after = [col['name'] for col in inspector.get_columns('family_budgets')]
                print(f"\n✅ Columnas en family_budgets: {', '.join(columns_after)}")
            else:
                print("⚠️ Tabla family_budgets no encontrada. Se creará automáticamente al iniciar el servidor.")
            
            db.commit()
            print("\n✅ Migración completada")
        except Exception as e:
            print(f"❌ Error durante la migración: {e}")
            db.rollback()
            raise

if __name__ == "__main__":
    run_migration()
