'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await signUp(email, password, fullName, clinicName)
      setSubmitted(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-green-600" />
            <span className="text-xl font-light text-gray-900">MicrobiomeRx</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-8">
            <h1 className="text-xl font-light text-gray-900 mb-2">
              Check your email
            </h1>
            <p className="text-sm text-gray-500">
              We sent a confirmation link to <span className="font-medium text-gray-700">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block mt-6 text-sm text-[#538A22] hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-green-600" />
            <span className="text-xl font-light text-gray-900">MicrobiomeRx</span>
          </div>
          <h1 className="text-2xl font-light text-gray-900 mb-1">
            Create your account
          </h1>
          <p className="text-sm text-gray-400">
            Clinical gut microbiome analysis platform
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-gray-400
                uppercase tracking-widest mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Jane Doe"
                required
                className="w-full bg-background border border-gray-200 rounded-lg
                  px-3 py-2.5 text-sm text-gray-900 outline-none
                  focus:border-[#538A22] focus:ring-2 focus:ring-green-50
                  transition"
              />
            </div>

          

            <div>
              <label className="block text-xs font-mono text-gray-400
                uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@clinic.com"
                required
                className="w-full bg-background border border-gray-200 rounded-lg
                  px-3 py-2.5 text-sm text-gray-900 outline-none
                  focus:border-[#538A22] focus:ring-2 focus:ring-green-50
                  transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-400
                uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-background border border-gray-200 rounded-lg
                  px-3 py-2.5 text-sm text-gray-900 outline-none
                  focus:border-[#538A22] focus:ring-2 focus:ring-green-50
                  transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg
                px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary
hover:bg-primary-hover
shadow-sm
                disabled:bg-gray-200 disabled:text-gray-400 text-white
                font-medium rounded-lg text-sm transition-all duration-200"
            >
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 font-mono">
          Already have an account?{' '}
          <Link href="/login" className="text-[#538A22] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}