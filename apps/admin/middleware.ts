import { NextResponse, type NextRequest } from "next/server";
import { isStaffOrAdmin } from "./lib/role";

const extractAccessToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const direct = request.cookies.get("sb-access-token")?.value;
  if (direct) return direct;

  const authCookie = request.cookies
    .getAll()
    .find((cookie) => cookie.name.includes("-auth-token"));

  if (!authCookie?.value) return null;

  try {
    const parsed = JSON.parse(authCookie.value) as { access_token?: string };
    if (parsed?.access_token) return parsed.access_token;
  } catch {
    // ignore malformed cookie
  }

  return null;
};

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const accessToken = extractAccessToken(request);
  if (!accessToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowed = await isStaffOrAdmin(accessToken);
  if (!allowed) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};

