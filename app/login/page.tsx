"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, resendConfirmation } from "@/lib/auth";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);

  // Coming from sign-up (?email=) or from the confirmation link (?confirmed=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromSignup = params.get("email");
    if (fromSignup) setEmail(fromSignup);
    if (params.get("confirmed")) setNotice("✓ Your email is confirmed. You can sign in now.");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setUnconfirmed(false);
    setLoading(true);

    try {
      if (!email || !password) {
        setError("Please enter email and password");
        return;
      }

      await signIn(email, password);
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      if (/email not confirmed/i.test(message)) {
        setUnconfirmed(true);
        setError("Your email isn't confirmed yet. Open the confirmation email we sent and click the link, then sign in.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendConfirmation(email);
      setNotice(`📧 A new confirmation link was sent to ${email}. Check your inbox and spam folder.`);
      setError("");
      setUnconfirmed(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend the email";
      // Supabase's built-in mail sender allows only a few emails per hour
      setError(
        /rate limit/i.test(message)
          ? "Too many emails were sent in the last hour, so a new link can't be sent yet. Use the link already sent, try again in about an hour, or ask an admin to confirm your account."
          : message
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-lg">🔨</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">DeliveryForge</h1>
          <p className="text-slate-600 mt-2">
            AI-powered delivery planning with complexity analysis
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {notice && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{notice}</div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              ❌ {error}
              {unconfirmed && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="block mt-2 font-semibold text-blue-700 underline hover:text-blue-900 disabled:opacity-50"
                >
                  {resending ? "Sending..." : "Resend confirmation email"}
                </button>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center">
          <p className="text-slate-600">
            Don't have an account?{" "}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
