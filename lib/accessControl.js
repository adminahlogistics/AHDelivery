import { NextResponse } from "next/server";

export function isDevelopmentDemoMode() {
  return process.env.NODE_ENV === "development";
}

export async function requireRole(role, demoUserId) {
  if (isDevelopmentDemoMode()) {
    return {
      authorized: true,
      role,
      demoMode: true,
      ...(role === "rider" && demoUserId ? { userId: demoUserId } : {}),
    };
  }

  return {
    authorized: false,
    response: NextResponse.json(
      {
        success: false,
        message:
          "Administrative access is disabled until a production authentication provider is configured.",
      },
      { status: 503 }
    ),
  };
}
