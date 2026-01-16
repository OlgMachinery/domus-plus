"""
Script de migración para agregar la columna display_names a la tabla family_budgets
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
    
    print("🚀 Iniciando migración: agregar display_names a family_budgets")
    
    with SessionLocal() as db:
        try:
            # Verificar si la columna ya existe
            inspector = inspect(engine)
            if 'family_budgets' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('family_budgets')]
                if 'display_names' not in columns:
                    print("🔄 Agregando columna display_names...")
                    # Agregar la columna
                    with engine.connect() as connection:
                        if DATABASE_URL.startswith("sqlite"):
                            # SQLite
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN display_names JSON"))
                        else:
                            # PostgreSQL
                            connection.execute(text("ALTER TABLE family_budgets ADD COLUMN display_names JSONB"))
                        connection.commit()
                    print("✅ Columna display_names agregada exitosamente")
                else:
                    print("ℹ️ Columna display_names ya existe. Saltando.")
            else:
                print("⚠️ Tabla family_budgets no encontrada. Se creará automáticamente al iniciar el servidor.")
            
            # Verificar columna
            if 'family_budgets' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('family_budgets')]
                if 'display_names' in columns:
                    print("✅ Verificación: columna display_names existe")
                else:
                    print("❌ Verificación fallida: columna display_names NO existe")
            
            db.commit()
            print("✅ Migración completada")
        except Exception as e:
            print(f"❌ Error durante la migración: {e}")
            db.rollback()
            raise

if __name__ == "__main__":
    run_migration()
