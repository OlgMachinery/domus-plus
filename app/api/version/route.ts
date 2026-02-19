import { NextResponse } from 'next/server'

const DEPLOY_ID = 'trigger-redeploy-2026-02-19'
const ROUTES_CHECK = ['/', '/budget-overview', '/login']

export async function GET() {
  return NextResponse.json({
    deploy: DEPLOY_ID,
    message: 'Si ves esto, el build reciente está desplegado.',
    routes: ROUTES_CHECK,
    timestamp: new Date().toISOString(),
  })
}
