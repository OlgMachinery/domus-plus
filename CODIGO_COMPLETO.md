# Código Completo de DOMUS+

Este archivo contiene todo el código fuente del proyecto DOMUS+.

## Estructura del Proyecto

```
domus-plus/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── routers/
│   │   │   ├── users.py
│   │   │   ├── families.py
│   │   │   ├── budgets.py
│   │   │   ├── transactions.py
│   │   │   ├── receipts.py
│   │   │   └── whatsapp.py
│   │   └── services/
│   │       ├── receipt_processor.py
│   │       └── whatsapp_service.py
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   ├── dashboard/page.tsx
    │   ├── transactions/page.tsx
    │   └── budgets/page.tsx
    ├── lib/
    │   └── api.ts
    └── package.json
```

Para ver el código completo de cada archivo, ejecuta:
- `cat backend/app/[archivo].py`
- `cat frontend/app/[archivo].tsx`

O abre los archivos directamente en tu editor.
