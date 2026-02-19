import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PREDEFINED_CATEGORIES, PREDEFINED_SUBCATEGORIES } from '@/lib/category-defaults'

const getAuthUser = async (supabase: Awaited<ReturnType<typeof createClient>>, request: NextRequest) => {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null
  if (token) {
    const result = await supabase.auth.getUser(token)
    if (!result.error && result.data.user) return result
  }
  return supabase.auth.getUser()
}

/** Si la familia no tiene categorías predefinidas sembradas, las inserta. */
async function seedPredefinedIfNeeded(supabase: Awaited<ReturnType<typeof createClient>>, familyId: number) {
  const { data: existing, error: countError } = await supabase
    .from('custom_categories')
    .select('id')
    .eq('family_id', familyId)
    .eq('is_predefined', true)
    .limit(1)

  if (countError != null) {
    // Columna is_predefined puede no existir aún
    if (String(countError.message || '').includes('is_predefined')) return
    throw countError
  }
  if (existing && existing.length > 0) return

  for (const catName of PREDEFINED_CATEGORIES) {
    const { data: inserted, error: insErr } = await supabase
      .from('custom_categories')
      .insert({
        family_id: familyId,
        name: catName,
        is_predefined: true,
        is_active: true,
      })
      .select('id')
      .single()
    if (insErr) {
      if (insErr.code === '23505') continue
      if (String(insErr.message || '').includes('is_predefined')) return
      throw insErr
    }
    const subs = PREDEFINED_SUBCATEGORIES[catName]
    if (inserted?.id && subs?.length) {
      await supabase.from('custom_subcategories').insert(
        subs.map((name) => ({
          custom_category_id: inserted.id,
          name,
          is_active: true,
        }))
      )
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)

    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json({ detail: 'No autenticado' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    await seedPredefinedIfNeeded(supabase, userData.family_id)

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('include_inactive') === 'true'

    let query = supabase
      .from('custom_categories')
      .select(`
        *,
        subcategories:custom_subcategories(*)
      `)
      .eq('family_id', userData.family_id)
      .order('name')

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: categories, error } = await query

    if (error) {
      console.error('Error obteniendo categorías:', error)
      return NextResponse.json(
        { detail: `Error al obtener categorías: ${error.message}` },
        { status: 500 }
      )
    }

    if (categories && !includeInactive) {
      categories.forEach((category: any) => {
        if (category.subcategories) {
          category.subcategories = category.subcategories.filter((sub: any) => sub.is_active)
        }
      })
    }

    return NextResponse.json(categories || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/custom-categories:', error)
    return NextResponse.json(
      { detail: `Error al obtener categorías: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    // Validaciones
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { detail: 'El nombre de la categoría es requerido' },
        { status: 400 }
      )
    }

    // Verificar que no exista una categoría con el mismo nombre
    const { data: existing } = await supabase
      .from('custom_categories')
      .select('id')
      .eq('family_id', userData.family_id)
      .eq('name', body.name.trim())
      .single()

    if (existing) {
      return NextResponse.json(
        { detail: `Ya existe una categoría con el nombre '${body.name}'` },
        { status: 400 }
      )
    }

    // Crear categoría
    const { data: category, error: categoryError } = await supabase
      .from('custom_categories')
      .insert({
        family_id: userData.family_id,
        name: body.name.trim(),
        description: body.description || null,
        icon: body.icon || null,
        color: body.color || null,
        is_active: true,
      })
      .select()
      .single()

    if (categoryError) {
      console.error('Error creando categoría:', categoryError)
      return NextResponse.json(
        { detail: `Error al crear categoría: ${categoryError.message}` },
        { status: 500 }
      )
    }

    // Crear subcategorías si se proporcionaron
    if (body.subcategories && Array.isArray(body.subcategories) && body.subcategories.length > 0) {
      const subcategoriesData = body.subcategories.map((sub: any) => ({
        custom_category_id: category.id,
        name: sub.name.trim(),
        description: sub.description || null,
        is_active: true,
      }))

      const { error: subError } = await supabase
        .from('custom_subcategories')
        .insert(subcategoriesData)

      if (subError) {
        console.error('Error creando subcategorías:', subError)
        // No fallar, solo loggear
      }

      // Obtener subcategorías creadas
      const { data: subcategories } = await supabase
        .from('custom_subcategories')
        .select('*')
        .eq('custom_category_id', category.id)
        .eq('is_active', true)

      return NextResponse.json({
        ...category,
        subcategories: subcategories || [],
      }, { status: 201 })
    }

    return NextResponse.json({
      ...category,
      subcategories: [],
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/custom-categories:', error)
    return NextResponse.json(
      { detail: `Error al crear categoría: ${error.message}` },
      { status: 500 }
    )
  }
}
