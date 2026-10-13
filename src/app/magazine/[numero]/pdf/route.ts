import { NextResponse, type NextRequest } from "next/server"

// Ancienne adresse de téléchargement : redirige vers /api/magazine/[numero]/pdf
export async function GET(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params
  return NextResponse.redirect(new URL(`/api/magazine/${encodeURIComponent(numero)}/pdf`, request.url), 308)
}
