import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Required: this call refreshes the session and must not be removed —
  // without it, expired sessions won't be refreshed and users get
  // logged out unpredictably.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup");
  // PWA metadata routes (manifest, favicon/apple-touch-icon, and the
  // manifest's own icon URLs) are fetched directly by the browser/OS's
  // install machinery, not via normal navigation — redirecting them to
  // /login for a logged-out visitor would hand back login HTML instead of
  // the actual JSON/image, breaking "Add to Home Screen" entirely.
  const isPwaMetadataRoute =
    path === "/manifest.webmanifest" ||
    path === "/icon.png" ||
    path === "/apple-icon.png" ||
    path.startsWith("/pwa-icons/");
  const isPublicRoute =
    isAuthRoute ||
    path.startsWith("/invite") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/api/") ||
    isPwaMetadataRoute;

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
