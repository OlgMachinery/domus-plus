import { NextRequest, NextResponse } from "next/server";

const REDIRECT_SLUGS = ["diagram", "diagrama"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (REDIRECT_SLUGS.includes(slug)) {
    return NextResponse.redirect(new URL("/ui/system-architecture", request.url), 302);
  }
  return NextResponse.json({ message: `Hello ${slug}!` });
}
