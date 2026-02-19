import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: receipt, error } = await supabase
      .from('receipts')
      .select(`
        *,
        items:receipt_items(*)
      `)
      .eq('id', parseInt(id))
      .eq('user_id', user.id)
      .single()

    if (error || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    return NextResponse.json(receipt)
  } catch (error) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingReceipt } = await supabase
      .from('receipts')
      .select('id')
      .eq('id', parseInt(id))
      .eq('user_id', user.id)
      .single()

    if (!existingReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Receipt deleted successfully' })
  } catch (error) {
    console.error('Error deleting receipt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
