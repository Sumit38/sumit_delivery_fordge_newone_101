"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    mobile: "",
    organization: "",
    role: "Tester",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const getPasswordStrength = (password: string) => {
    if (password.length < 6) return "weak";
    if (password.length < 10) return "medium";
    if (/[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
      return "strong";
    }
    return "medium";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email) errors.email = "Email is required";
    else if (!validateEmail(formData.email)) errors.email = "Please enter a valid email";

    if (!formData.password) errors.password = "Password is required";
    else if (formData.password.length < 6) errors.password = "Password must be at least 6 characters";

    if (!formData.confirmPassword) errors.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Passwords do not match";

    if (!formData.mobile) errors.mobile = "Mobile number is required";
    if (!formData.organization) errors.organization = "Organization is required";
    if (!acceptedTerms) errors.terms = "Please accept Terms & Conditions";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup-dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          mobile: formData.mobile,
          organization: formData.organization,
          role: formData.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Success Modal */}
        {success && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h3>
              <p className="text-slate-600 mb-4">Redirecting to login...</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-lg">🔨</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Join DeliveryForge</h1>
          <p className="text-slate-600 mt-2">
            Automation of End to End Project Management
          </p>
        </div>

        {/* General Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6">
            ❌ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                fieldErrors.email
                  ? "border-red-300 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-500"
              }`}
              disabled={loading}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 mt-1">⚠️ {fieldErrors.email}</p>
            )}
          </div>

          {/* Mobile */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mobile Number *
            </label>
            <input
              type="tel"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              placeholder="+1234567890"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                fieldErrors.mobile
                  ? "border-red-300 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-500"
              }`}
              disabled={loading}
            />
            {fieldErrors.mobile && (
              <p className="text-xs text-red-600 mt-1">⚠️ {fieldErrors.mobile}</p>
            )}
          </div>

          {/* Organization */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Organization *
            </label>
            <input
              type="text"
              name="organization"
              value={formData.organization}
              onChange={handleChange}
              placeholder="Your Company"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                fieldErrors.organization
                  ? "border-red-300 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-500"
              }`}
              disabled={loading}
            />
            {fieldErrors.organization && (
              <p className="text-xs text-red-600 mt-1">⚠️ {fieldErrors.organization}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="Tester">Tester</option>
              <option value="Test Analyst">Test Analyst</option>
              <option value="Test Manager">Test Manager</option>
              <option value="QA Lead">QA Lead</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                fieldErrors.password
                  ? "border-red-300 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-500"
              }`}
              disabled={loading}
            />
            {fieldErrors.password && (
              <p className="text-xs text-red-600 mt-1">⚠️ {fieldErrors.password}</p>
            )}
            {formData.password && !fieldErrors.password && (
              <div className="mt-2 flex gap-2 items-center">
                <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      getPasswordStrength(formData.password) === "strong"
                        ? "bg-green-500 w-full"
                        : getPasswordStrength(formData.password) === "medium"
                          ? "bg-yellow-500 w-2/3"
                          : "bg-red-500 w-1/3"
                    }`}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {getPasswordStrength(formData.password) === "strong"
                    ? "Strong"
                    : getPasswordStrength(formData.password) === "medium"
                      ? "Medium"
                      : "Weak"}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirm Password *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                fieldErrors.confirmPassword
                  ? "border-red-300 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-500"
              }`}
              disabled={loading}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">⚠️ {fieldErrors.confirmPassword}</p>
            )}
          </div>

          {/* Terms & Conditions */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  if (e.target.checked && fieldErrors.terms) {
                    setFieldErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.terms;
                      return updated;
                    });
                  }
                }}
                disabled={loading}
                className="w-4 h-4 border-slate-300 rounded cursor-pointer"
              />
              <span className="text-sm text-slate-600">
                I agree to the{" "}
                <Link href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  Terms & Conditions
                </Link>
                {" "}and{" "}
                <Link href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  Privacy Policy
                </Link>
                {" "}*
              </span>
            </label>
            {fieldErrors.terms && (
              <p className="text-xs text-red-600 mt-1">⚠️ {fieldErrors.terms}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating account...
              </div>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <div className="text-center mt-6">
          <p className="text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 pt-8 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-600 uppercase mb-3">What you get:</p>
          <ul className="space-y-2 text-xs text-slate-600">
            <li>✓ Classify requirements and analyze business impact</li>
            <li>✓ Calculate complexity for development & testing</li>
            <li>✓ Generate testing & development strategies</li>
            <li>✓ Create complete delivery plans with budgets & timelines</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
