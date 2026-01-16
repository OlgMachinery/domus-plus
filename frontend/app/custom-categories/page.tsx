'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import { PlusIcon, XIcon, EditIcon, TrashIcon } from '@/lib/icons'
import SAPLayout from '@/components/SAPLayout'
import { getLanguage, setLanguage, useTranslation, type Language } from '@/lib/i18n'

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
      <SAPLayout user={user} title={language === 'es' ? 'Categorías Personalizadas' : 'Custom Categories'} toolbar={null}>
        <div className="flex items-center justify-center py-12">
          <div className="text-sap-text-secondary">{language === 'es' ? 'Cargando...' : 'Loading...'}</div>
        </div>
      </SAPLayout>
    )
  }

  return (
    <SAPLayout
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
            <p className="text-sap-text-secondary mb-4">
              {language === 'es' ? 'No hay categorías personalizadas creadas' : 'No custom categories created'}
            </p>
            <p className="text-sm text-sap-text-secondary">
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
                      <h3 className="text-lg font-semibold text-sap-text" style={{ color: category.color || undefined }}>
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-sap-text-secondary mt-1">{category.description}</p>
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
                    <h4 className="text-sm font-medium text-sap-text-secondary mb-2">
                      {language === 'es' ? 'Subcategorías:' : 'Subcategories:'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {category.subcategories.map((subcat) => (
                        <span
                          key={subcat.id}
                          className="px-3 py-1 bg-sap-bgSecondary rounded text-sm text-sap-text"
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
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-sap-text">
                  {language === 'es' ? 'Crear Nueva Categoría' : 'Create New Category'}
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="sap-button-ghost p-2"
                >
                  <XIcon size={18} className="text-sap-text-secondary" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                    {language === 'es' ? 'Nombre de la Categoría *' : 'Category Name *'}
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="sap-input w-full"
                    placeholder={language === 'es' ? 'Ej: Mascotas, Hobbies, etc.' : 'E.g: Pets, Hobbies, etc.'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                    {language === 'es' ? 'Descripción' : 'Description'}
                  </label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                    className="sap-input w-full"
                    rows={3}
                    placeholder={language === 'es' ? 'Descripción opcional...' : 'Optional description...'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                      {language === 'es' ? 'Icono (emoji)' : 'Icon (emoji)'}
                    </label>
                    <input
                      type="text"
                      value={newCategory.icon}
                      onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                      className="sap-input w-full"
                      placeholder="🐾 🎨 🏠"
                      maxLength={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-sap-text-secondary mb-1">
                      {language === 'es' ? 'Color' : 'Color'}
                    </label>
                    <input
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      className="sap-input w-full h-10"
                    />
                  </div>
                </div>

                {/* Subcategorías */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-sap-text-secondary">
                      {language === 'es' ? 'Subcategorías' : 'Subcategories'}
                    </label>
                    <button
                      onClick={handleAddSubcategory}
                      className="sap-button-secondary text-xs flex items-center gap-1"
                    >
                      <PlusIcon size={14} />
                      {language === 'es' ? 'Agregar' : 'Add'}
                    </button>
                  </div>

                  {newCategory.subcategories.map((subcat, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={subcat.name}
                        onChange={(e) => handleSubcategoryChange(index, 'name', e.target.value)}
                        className="sap-input flex-1"
                        placeholder={language === 'es' ? 'Nombre de subcategoría' : 'Subcategory name'}
                      />
                      <button
                        onClick={() => handleRemoveSubcategory(index)}
                        className="sap-button-ghost text-sap-danger"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateCategory}
                    className="sap-button-primary flex-1"
                  >
                    {language === 'es' ? 'Crear Categoría' : 'Create Category'}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="sap-button-secondary flex-1"
                  >
                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SAPLayout>
  )
}
