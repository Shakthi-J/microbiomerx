'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
  
    try {
      await signIn(email, password)
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
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
            Doctor login
          </h1>
          <p className="text-sm text-gray-400">
            Clinical gut microbiome analysis platform
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-4">
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
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 font-mono">
          For access contact your administrator
        </p>
      </div>
    </div>
  )
}
