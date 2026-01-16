# 🖥️ Organizar Terminales - DOMUS+

## Necesitas Solo 2 Terminales

### Terminal 1: Frontend (Next.js)
**Ubicación**: `/Users/gonzalomontanofimbres/domus-plus/frontend`

**Comando que debe estar corriendo:**
```bash
npm run dev
```

**Deberías ver:**
```
- Local:        http://localhost:3000
✓ Ready in X.Xs
```

**Si no está corriendo:**
```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
npm run dev
```

---

### Terminal 2: Backend (FastAPI)
**Ubicación**: `/Users/gonzalomontanofimbres/domus-plus/backend`

**Comando que debe estar corriendo:**
```bash
uvicorn app.main:app --reload
```

**Deberías ver:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

**Si no está corriendo:**
```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
pip install -r requirements-minimal.txt
uvicorn app.main:app --reload
```

---

## ✅ Verificar que Todo Está Corriendo

### Terminal 1 (Frontend)
- Debe mostrar: `- Local: http://localhost:3000`
- Si no, ejecuta: `npm run dev`

### Terminal 2 (Backend)
- Debe mostrar: `INFO: Uvicorn running on http://127.0.0.1:8000`
- Si no, ejecuta: `uvicorn app.main:app --reload`

---

## 🗑️ Cerrar Terminales Extra

Puedes cerrar todas las demás terminales que no sean estas dos.

**Para cerrar una terminal:**
- Presiona `Ctrl+C` para detener el proceso
- O simplemente cierra la ventana

---

## 📝 Resumen

**Solo necesitas 2 terminales abiertas:**

1. **Terminal Frontend**: `npm run dev` → http://localhost:3000
2. **Terminal Backend**: `uvicorn app.main:app --reload` → http://localhost:8000

Cierra todas las demás.

