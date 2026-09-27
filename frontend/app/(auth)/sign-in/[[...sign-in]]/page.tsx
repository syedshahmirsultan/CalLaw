"use client";

import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignInPage() {
  // useSearchParams (for the return URL) needs a Suspense boundary.
  return (
    <Suspense>
      <AuthShell mode="sign-in" />
    </Suspense>
  );
}
