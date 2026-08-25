"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { handleAuthCallback } from "@/lib/auth";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await handleAuthCallback();
        router.push("/dashboard");
      } catch (error) {
        console.error("Callback error:", error);
        router.push("/login?error=auth_failed");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
          <span className="text-white font-bold text-lg">🔨</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Signing you in...</h1>
        <p className="text-slate-600">Please wait while we complete your authentication.</p>
      </div>
    </div>
  );
}
