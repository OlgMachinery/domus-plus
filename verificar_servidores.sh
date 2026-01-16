#!/bin/bash

echo "🔍 Verificando estado de los servidores DOMUS+..."
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar Backend (Puerto 8000)
echo "📡 Verificando Backend (Puerto 8000)..."
BACKEND_PID=$(lsof -ti :8000 2>/dev/null)
if [ -z "$BACKEND_PID" ]; then
    echo -e "${RED}❌ Backend NO está corriendo${NC}"
    echo "   Ejecuta: cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    BACKEND_OK=false
else
    echo -e "${GREEN}✅ Backend está corriendo (PID: $BACKEND_PID)${NC}"
    
    # Verificar que responde
    HEALTH_RESPONSE=$(curl -s http://localhost:8000/health 2>/dev/null)
    if [[ "$HEALTH_RESPONSE" == *"ok"* ]]; then
        echo -e "${GREEN}   ✅ Health check: OK${NC}"
        BACKEND_OK=true
    else
        echo -e "${YELLOW}   ⚠️  Health check: No responde correctamente${NC}"
        BACKEND_OK=false
    fi
fi

echo ""

# Verificar Frontend (Puerto 3000)
echo "🌐 Verificando Frontend (Puerto 3000)..."
FRONTEND_PID=$(lsof -ti :3000 2>/dev/null)
if [ -z "$FRONTEND_PID" ]; then
    echo -e "${RED}❌ Frontend NO está corriendo${NC}"
    echo "   Ejecuta: cd frontend && npm run dev"
    FRONTEND_OK=false
else
    echo -e "${GREEN}✅ Frontend está corriendo (PID: $FRONTEND_PID)${NC}"
    
    # Verificar que responde
    FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    if [ "$FRONTEND_RESPONSE" == "200" ]; then
        echo -e "${GREEN}   ✅ HTTP Status: 200 OK${NC}"
        FRONTEND_OK=true
    else
        echo -e "${YELLOW}   ⚠️  HTTP Status: $FRONTEND_RESPONSE${NC}"
        FRONTEND_OK=false
    fi
fi

echo ""

# Verificar Base de Datos
echo "💾 Verificando Base de Datos..."
if [ -f "backend/domus_plus.db" ]; then
    DB_SIZE=$(ls -lh backend/domus_plus.db | awk '{print $5}')
    echo -e "${GREEN}✅ Base de datos existe (Tamaño: $DB_SIZE)${NC}"
    DB_OK=true
else
    echo -e "${RED}❌ Base de datos NO existe${NC}"
    echo "   Ejecuta: cd backend && python3 init_db.py"
    DB_OK=false
fi

echo ""

# Verificar Entorno Virtual
echo "🐍 Verificando Entorno Virtual..."
if [ -d "backend/venv" ]; then
    echo -e "${GREEN}✅ Entorno virtual existe${NC}"
    VENV_OK=true
else
    echo -e "${YELLOW}⚠️  Entorno virtual NO existe${NC}"
    echo "   Ejecuta: cd backend && python3 -m venv venv"
    VENV_OK=false
fi

echo ""

# Verificar Node Modules
echo "📦 Verificando Dependencias Frontend..."
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✅ node_modules existe${NC}"
    NODE_OK=true
else
    echo -e "${YELLOW}⚠️  node_modules NO existe${NC}"
    echo "   Ejecuta: cd frontend && npm install"
    NODE_OK=false
fi

echo ""
echo "="*70
echo "📊 RESUMEN"
echo "="*70

if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ] && [ "$DB_OK" = true ]; then
    echo -e "${GREEN}✅ TODO ESTÁ FUNCIONANDO CORRECTAMENTE${NC}"
    echo ""
    echo "🌐 URLs disponibles:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:8000"
    echo "   API Docs: http://localhost:8000/docs"
    echo ""
    echo "📱 Para probar Twilio:"
    echo "   cd backend && source venv/bin/activate && python3 probar_mensaje_confirmacion.py"
    exit 0
else
    echo -e "${RED}❌ HAY PROBLEMAS QUE RESOLVER${NC}"
    echo ""
    if [ "$BACKEND_OK" = false ]; then
        echo -e "${RED}   • Backend no está corriendo${NC}"
    fi
    if [ "$FRONTEND_OK" = false ]; then
        echo -e "${RED}   • Frontend no está corriendo${NC}"
    fi
    if [ "$DB_OK" = false ]; then
        echo -e "${RED}   • Base de datos no existe${NC}"
    fi
    if [ "$VENV_OK" = false ]; then
        echo -e "${YELLOW}   • Entorno virtual no existe${NC}"
    fi
    if [ "$NODE_OK" = false ]; then
        echo -e "${YELLOW}   • Dependencias frontend no instaladas${NC}"
    fi
    echo ""
    echo "💡 Usa el script de reinicio:"
    echo "   ./reiniciar_servidores.sh"
    exit 1
fi
