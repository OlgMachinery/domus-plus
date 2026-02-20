'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import { PlusIcon, XIcon, EditIcon, TrashIcon } from '@/lib/icons'
import AppLayout from "@/components/AppLayout"
import { getLanguage, setLanguage, useTranslation, type Language } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

interface CustomSubcategory {
  id: number
  name: string
  description?: string
  is_active: boolean
}

interface CustomCategory {
  id: number
  name: string
  description?: string
  icon?: string
  color?: string
  is_active: boolean
  subcategories: CustomSubcategory[]
}

export const dynamic = 'force-dynamic'

export default function CustomCategoriesPage() {
  const router = useRouter()
  const [language, setLanguageState] = useState<Language>('es')
  const [mounted, setMounted] = useState(false)
  const t = useTranslation(language)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<CustomCategory[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null)
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    icon: '',
    color: '#0070f2',
    subcategories: [] as Array<{ name: string; description: string }>
  })

  useEffect(() => {
    setMounted(true)
    setLanguageState(getLanguage())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      loadUser()
    })
  }, [router])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/login')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (userData) {
        setUser(userData as User)
        await loadCategories()
      }
    } catch (error) {
      console.error('Error cargando usuario:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (!userData?.family_id) {
        setCategories([])
        return
      }
      
      const { data: categoriesData } = await supabase
        .from('custom_categories')
        .select(`
          *,
          subcategories:custom_subcategories(*)
        `)
        .eq('family_id', userData.family_id)
        .eq('is_active', true)
      
      setCategories((categoriesData || []) as CustomCategory[])
    } catch (error) {
      console.error('Error cargando categorías:', error)
      setCategories([])
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      alert(language === 'es' ? 'El nombre de la categoría es requerido' : 'Category name is required')
      return
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        alert('No autenticado')
        return
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', authUser.id)
        .single()
      
      if (!userData?.family_id) {
        alert('Usuario no tiene familia asignada')
        return
      }
      
      // Crear categoría
      const { data: categoryData, error: categoryError } = await supabase
        .from('custom_categories')
        .insert({
          family_id: userData.family_id,
          name: newCategory.name,
          description: newCategory.description,
          icon: newCategory.icon,
          color: newCategory.color,
          is_active: true
        })
        .select()
        .single()
      
      if (categoryError || !categoryData) {
        throw categoryError || new Error('Error al crear categoría')
      }
      
      // Crear subcategorías si hay
      if (newCategory.subcategories.length > 0) {
        const subcategoriesToInsert = newCategory.subcategories.map(sub => ({
          custom_category_id: categoryData.id,
          name: sub.name,
          description: sub.description,
          is_active: true
        }))
        
        const { error: subError } = await supabase
          .from('custom_subcategories')
          .insert(subcategoriesToInsert)
        
        if (subError) {
          console.error('Error creando subcategorías:', subError)
        }
      }
      await loadCategories()
      setShowCreateModal(false)
      setNewCategory({
        name: '',
        description: '',
        icon: '',
        color: '#0070f2',
        subcategories: []
      })
      alert(language === 'es' ? 'Categoría creada exitosamente' : 'Category created successfully')
    } catch (error: any) {
      console.error('Error creando categoría:', error)
      alert(error.message || (language === 'es' ? 'Error al crear categoría' : 'Error creating category'))
    }
  }

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm(language === 'es' ? '¿Estás seguro de eliminar esta categoría?' : 'Are you sure you want to delete this category?')) {
      return
    }

    try {
      // Marcar como inactiva en lugar de eliminar
      const { error: updateError } = await supabase
        .from('custom_categories')
        .update({ is_active: false })
        .eq('id', categoryId)
      
      if (updateError) {
        throw updateError
      }
      
      await loadCategories()
      alert(language === 'es' ? 'Categoría eliminada exitosamente' : 'Category deleted successfully')
    } catch (error: any) {
      console.error('Error eliminando categoría:', error)
      alert(error.message || (language === 'es' ? 'Error al eliminar categoría' : 'Error deleting category'))
    }
  }

  const handleAddSubcategory = () => {
    setNewCategory({
      ...newCategory,
      subcategories: [...newCategory.subcategories, { name: '', description: '' }]
    })
  }

  const handleRemoveSubcategory = (index: number) => {
    setNewCategory({
      ...newCategory,
      subcategories: newCategory.subcategories.filter((_, i) => i !== index)
    })
  }

  const handleSubcategoryChange = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...newCategory.subcategories]
    updated[index] = { ...updated[index], [field]: value }
    setNewCategory({ ...newCategory, subcategories: updated })
  }

  const toggleLanguage = () => {
    const newLang = language === 'es' ? 'en' : 'es'
    setLanguage(newLang)
    setLanguageState(newLang)
  }

  const toolbar = (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={toggleLanguage}
        className="sap-button-secondary text-sm px-3 py-1.5 min-w-[60px] h-[36px] flex items-center justify-center"
      >
        {language === 'es' ? '🇲🇽 ES' : '🇺🇸 EN'}
      </button>
    </div>
  )

  if (loading) {
    return (
      <AppLayout user={user} title={language === 'es' ? 'Categorías Personalizadas' : 'Custom Categories'} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      user={user}
      title={language === 'es' ? 'Categorías Personalizadas' : 'Custom Categories'}
      subtitle={language === 'es' ? 'Crea y gestiona tus propias categorías y subcategorías para presupuestos' : 'Create and manage your own categories and subcategories for budgets'}
      toolbar={toolbar}
    >
      <div className="space-y-6">
        {/* Botón crear */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="sap-button-primary flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            {language === 'es' ? 'Crear Nueva Categoría' : 'Create New Category'}
          </button>
        </div>

        {/* Lista de categorías */}
        {categories.length === 0 ? (
          <div className="sap-card p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {language === 'es' ? 'No hay categorías personalizadas creadas' : 'No custom categories created'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'es' 
                ? 'Crea tu primera categoría personalizada para organizar mejor tus presupuestos'
                : 'Create your first custom category to better organize your budgets'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {categories.map((category) => (
              <div key={category.id} className="sap-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {category.icon && (
                      <span className="text-2xl">{category.icon}</span>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground" style={{ color: category.color || undefined }}>
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="sap-button-ghost text-sap-danger hover:bg-red-50"
                    title={language === 'es' ? 'Eliminar' : 'Delete'}
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>

                {/* Subcategorías */}
                {category.subcategories.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      {language === 'es' ? 'Subcategorías:' : 'Subcategories:'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {category.subcategories.map((subcat) => (
                        <span
                          key={subcat.id}
                          className="px-3 py-1 bg-backgroundSecondary rounded text-sm text-foreground"
                        >
                          {subcat.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal crear categoría */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {language === 'es' ? 'Crear Nueva Categoría' : 'Create New Category'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {language === 'es' ? 'Nombre de la Categoría *' : 'Category Name *'}
                </Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder={language === 'es' ? 'Ej: Mascotas, Hobbies, etc.' : 'E.g: Pets, Hobbies, etc.'}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {language === 'es' ? 'Descripción' : 'Description'}
                </Label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                  placeholder={language === 'es' ? 'Descripción opcional...' : 'Optional description...'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {language === 'es' ? 'Icono (emoji)' : 'Icon (emoji)'}
                  </Label>
                  <Input
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                    placeholder="🐾 🎨 🏠"
                    maxLength={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    {language === 'es' ? 'Color' : 'Color'}
                  </Label>
                  <Input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="h-10 p-1"
                  />
                </div>
              </div>

              {/* Subcategorías */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {language === 'es' ? 'Subcategorías' : 'Subcategories'}
                  </Label>
                  <Button variant="outline" size="sm" onClick={handleAddSubcategory}>
                    <PlusIcon size={14} className="mr-1" />
                    {language === 'es' ? 'Agregar' : 'Add'}
                  </Button>
                </div>

                {newCategory.subcategories.map((subcat, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={subcat.name}
                      onChange={(e) => handleSubcategoryChange(index, 'name', e.target.value)}
                      placeholder={language === 'es' ? 'Nombre de subcategoría' : 'Subcategory name'}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSubcategory(index)}
                    >
                      <XIcon size={16} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleCreateCategory} className="flex-1">
                  {language === 'es' ? 'Crear Categoría' : 'Create Category'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
