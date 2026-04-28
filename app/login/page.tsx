"use client"

import { useState, Suspense } from "react"
import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, Check, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFunctions, httpsCallable } from "firebase/functions"
import { trackEvent, trackSignUp } from "@/components/tracking/facebook-pixel"
import { toast } from "sonner"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const showRegister = searchParams?.get("register") === "true"
  const nextParam = searchParams?.get("next")
  // Defense against open-redirect via protocol-relative URLs and Windows-style
  // backslash paths. router.push("//evil.com/foo") would navigate externally;
  // router.push("/\\evil.com") normalises the same way on some clients.
  // Allow only same-origin absolute paths.
  const safeNext =
    nextParam &&
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.startsWith("/\\")
      ? nextParam
      : null
  const [activeTab, setActiveTab] = useState(showRegister ? "register" : "login")
  const { signIn, signUp, googleSignIn, resetPassword } = useFirebase()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await signIn(email, password)
      router.push(safeNext || "/dashboard")
    } catch (error: unknown) {
      console.error("Login error:", error)
      const message = error instanceof Error ? error.message : String(error)
      setError(message || "Failed to sign in. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      return setError("Passwords do not match")
    }

    setLoading(true)

    try {
      await signUp(email, password)

      // Track successful registration for Facebook Pixel
      trackSignUp()
      trackEvent('CompleteRegistration', {
        content_name: 'User Registration',
        method: 'email'
      })

      // Send welcome email notification
      try {
        const functions = getFunctions();
        const sendWelcomeEmailNotification = httpsCallable(
          functions,
          'sendWelcomeEmailNotification'
        );

        await sendWelcomeEmailNotification({
          // We can pass additional data if needed
          displayName: email.split('@')[0] // Use part of email as a fallback display name
        });
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Don't fail the overall registration if email fails
      }

      router.push(safeNext || "/dashboard")
    } catch (error: unknown) {
      console.error("Registration error:", error)
      const message = error instanceof Error ? error.message : String(error)
      setError(message || "Failed to create account. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError("")

    try {
      const result = await googleSignIn()

      // Check if this is a new user
      // Access additional user info which contains isNewUser
      // @ts-ignore - Firebase typings may be incomplete
      const isNewUser = result.additionalUserInfo?.isNewUser || false;

      // Track successful Google sign-in for new users
      if (isNewUser) {
        trackSignUp()
        trackEvent('CompleteRegistration', {
          content_name: 'User Registration',
          method: 'google'
        })
      }

      // Only send welcome email for new users
      if (isNewUser) {
        try {
          const functions = getFunctions();
          const sendWelcomeEmailNotification = httpsCallable(
            functions,
            'sendWelcomeEmailNotification'
          );

          // Pass displayName for Google sign-in
          const userDisplayName = result.user?.displayName || result.user?.email?.split('@')[0];
          await sendWelcomeEmailNotification({ displayName: userDisplayName });
        } catch (emailError) {
          console.error("Error sending welcome email for Google sign-in:", emailError);
          // Don't fail the overall sign-in if email fails
        }
      }

      router.push(safeNext || "/dashboard")
    } catch (error: unknown) {
      console.error("Google sign-in error:", error)
      const message = error instanceof Error ? error.message : String(error)
      setError(message || "Failed to sign in with Google. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      return setError("Please enter your email address")
    }

    setLoading(true)
    setError("")

    try {
      await resetPassword(email)
      toast.success("Password reset email sent. Check your inbox.")
    } catch (error: unknown) {
      console.error("Password reset error:", error)
      const message = error instanceof Error ? error.message : String(error)
      setError(message || "Failed to send password reset email. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
      <path d="M1 1h22v22H1z" fill="none" />
    </svg>
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-[#fbf8f6] via-[#f7f4f3] to-white">
      {/* Soft background blobs */}
      <div className="pointer-events-none absolute -top-[10%] -right-[5%] w-[40%] h-[40%] rounded-full bg-gradient-to-r from-purple-100 to-pink-100 blur-3xl opacity-50" />
      <div className="pointer-events-none absolute bottom-[5%] -left-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-r from-orange-100 to-amber-100 blur-3xl opacity-50" />

      {/* Top bar with brand + back link */}
      <header className="relative z-10">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold">
              Story<span className="text-orange-500">InColor</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-5xl grid gap-10 md:grid-cols-2 items-center">
          {/* Left column: form */}
          <div className="w-full max-w-md mx-auto md:mx-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Card className="shadow-md border-gray-200">
                  <CardHeader>
                    <CardTitle>Welcome back</CardTitle>
                    <CardDescription>Sign in to access your dashboard and credits.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="name@example.com"
                          autoComplete="email"
                          autoFocus
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Password</Label>
                          <button
                            type="button"
                            onClick={handleResetPassword}
                            className="text-xs text-orange-500 hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <Input
                          id="password"
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                    </form>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-gray-500">Or continue with</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <GoogleIcon />
                      Sign in with Google
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="register">
                <Card className="shadow-md border-gray-200">
                  <CardHeader>
                    <CardTitle>Create your account</CardTitle>
                    <CardDescription>
                      Sign up and get free starter credits to try any tool.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-email">Email</Label>
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="name@example.com"
                          autoComplete="email"
                          autoFocus
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-password">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create account"
                        )}
                      </Button>
                    </form>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-gray-500">Or continue with</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <GoogleIcon />
                      Sign up with Google
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column: marketing */}
          <aside className="hidden md:block">
            <div className="rounded-2xl bg-white/70 backdrop-blur p-8 border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-bold tracking-tight">
                Why sign in?
              </h2>
              <ul className="mt-6 space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                    <Check className="h-3.5 w-3.5 text-orange-600" />
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Free starter credits</p>
                    <p className="text-sm text-gray-600">
                      New accounts get free credits to try a tool right away.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                    <Check className="h-3.5 w-3.5 text-orange-600" />
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Save your generations</p>
                    <p className="text-sm text-gray-600">
                      Every result is saved to your dashboard — re-download any time.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                    <Check className="h-3.5 w-3.5 text-orange-600" />
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">Buy more credits any time</p>
                    <p className="text-sm text-gray-600">
                      Top up in seconds when you want to try another tool.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <footer className="relative z-10 border-t border-gray-200/70 bg-white/60 backdrop-blur">
        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-gray-500">
              © 2026 Story In Color. All rights reserved.
            </p>
            <nav className="flex gap-4 md:gap-6">
              <Link href="/terms" className="text-xs hover:underline underline-offset-4">
                Terms
              </Link>
              <Link href="/privacy" className="text-xs hover:underline underline-offset-4">
                Privacy
              </Link>
              <Link href="/contact" className="text-xs hover:underline underline-offset-4">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Wrap the component in a Suspense boundary
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
