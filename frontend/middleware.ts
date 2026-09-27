import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk needs its middleware to manage sessions. Nothing is route-protected here:
// guests may try one question, and the API enforces sign-up after that.
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
