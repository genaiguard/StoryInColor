"use client";

import { useState, Suspense } from "react";
import type React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";
import { useFirebase } from "@/app/firebase/firebase-provider";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { newEventId, trackCompleteRegistration } from "@/lib/analytics/events";
import { persistUserProfileAndAttribution } from "@/lib/attribution/persist";
import { toast } from "sonner";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-white/30 focus:outline-none focus:ring-0";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const showRegister = searchParams?.get("register") === "true";
  const nextParam = searchParams?.get("next");
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
      : null;
  const [activeTab, setActiveTab] = useState(showRegister ? "register" : "login");
  const { signIn, signUp, googleSignIn, resetPassword } = useFirebase();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(email, password);
      router.push(safeNext || "/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }

    setLoading(true);

    try {
      await signUp(email, password);

      // Persist profile + attribution to users/{uid} so the admin dashboard
      // and downstream analytics can see what brought this user. Awaited (not
      // fire-and-forget) so the redirect to /dashboard isn't racy with an
      // un-persisted firstTouch — but we swallow errors because attribution
      // failure must NEVER block account creation.
      const newUser = getAuth().currentUser;
      if (newUser) {
        try {
          await persistUserProfileAndAttribution({
            uid: newUser.uid,
            email: newUser.email,
            displayName: newUser.displayName ?? email.split("@")[0],
            providerId: "password",
            createdAtIso:
              newUser.metadata.creationTime ?? new Date().toISOString(),
          });
        } catch (attrError) {
          console.error("Failed to persist attribution on email signup:", attrError);
        }
      }

      // Mint a shared event_id so the Pixel emit (now) and the CAPI mirror
      // fired by ensureUserCredits (later, when the dashboard mounts) land
      // on Meta with the same id and dedupe within the 48h window.
      const regEventId = newEventId();
      try {
        window.localStorage.setItem(
          "sic_pending_registration_event_id",
          regEventId,
        );
      } catch {
        // privacy mode — Pixel still fires, server will mint its own id
      }
      trackCompleteRegistration({ method: "email", eventId: regEventId });

      try {
        const functions = getFunctions();
        const sendWelcomeEmailNotification = httpsCallable(
          functions,
          "sendWelcomeEmailNotification",
        );
        await sendWelcomeEmailNotification({
          displayName: email.split("@")[0],
        });
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
      }

      router.push(safeNext || "/dashboard");
    } catch (err: unknown) {
      console.error("Registration error:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await googleSignIn();
      // Firebase v9+ doesn't expose additionalUserInfo on UserCredential
      // typings, but the runtime still returns it via getAdditionalUserInfo.
      // Cast through unknown to read it without committing to a type.
      const additional = (result as unknown as {
        additionalUserInfo?: { isNewUser?: boolean };
      }).additionalUserInfo;
      const isNewUser = additional?.isNewUser || false;

      if (isNewUser) {
        // Persist profile + attribution before any other side-effect so the
        // welcome email + tracking calls have a populated users/{uid} doc.
        // Same swallow-errors policy as the email path.
        if (result.user) {
          try {
            await persistUserProfileAndAttribution({
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              providerId: "google.com",
              createdAtIso:
                result.user.metadata?.creationTime ?? new Date().toISOString(),
            });
          } catch (attrError) {
            console.error(
              "Failed to persist attribution on Google signup:",
              attrError,
            );
          }
        }

        // Mint a shared event_id (same pattern as the email path) so the
        // Pixel emit and the CAPI mirror dedupe.
        const regEventId = newEventId();
        try {
          window.localStorage.setItem(
            "sic_pending_registration_event_id",
            regEventId,
          );
        } catch {
          // privacy mode — Pixel still fires, server will mint its own id
        }
        trackCompleteRegistration({ method: "google", eventId: regEventId });

        try {
          const functions = getFunctions();
          const sendWelcomeEmailNotification = httpsCallable(
            functions,
            "sendWelcomeEmailNotification",
          );
          const userDisplayName =
            result.user?.displayName || result.user?.email?.split("@")[0];
          await sendWelcomeEmailNotification({ displayName: userDisplayName });
        } catch (emailError) {
          console.error(
            "Error sending welcome email for Google sign-in:",
            emailError,
          );
        }
      }

      router.push(safeNext || "/dashboard");
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to sign in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      return setError("Please enter your email address");
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword(email);
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err: unknown) {
      console.error("Password reset error:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5">
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
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white">
      {/* Cinematic spotlight backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.07),_transparent_60%)]"
      />

      <header className="relative z-10">
        <div className="container mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link
            href="/"
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Link
            href="/"
            className="text-base font-semibold tracking-[-0.02em] sm:text-lg"
          >
            <span className="font-light">Story</span>
            <span className="font-semibold">In</span>
            <span className="font-light">Color</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 md:py-14">
        <div className="grid w-full max-w-5xl items-center gap-10 md:grid-cols-2">
          <div className="mx-auto w-full max-w-md md:mx-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-2 rounded-full bg-white/[0.04] p-1">
                <TabsTrigger
                  value="login"
                  className="rounded-full text-sm text-gray-400 data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-full text-sm text-gray-400 data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Create account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <div className="liquid-glass rounded-2xl p-6 md:p-8">
                  <h1
                    className="text-3xl font-normal tracking-[-0.04em] md:text-4xl"
                  >
                    Welcome{" "}
                    <span className="italic font-light text-gray-300">back.</span>
                  </h1>
                  <p className="mt-2 text-sm text-gray-400">
                    Sign in to access your dashboard and readings.
                  </p>

                  {error && (
                    <div
                      role="alert"
                      className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm text-red-200"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="email"
                        className="text-xs font-medium uppercase tracking-wider text-gray-400"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="password"
                          className="text-xs font-medium uppercase tracking-wider text-gray-400"
                        >
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          className="text-xs text-gray-300 transition-colors hover:text-white"
                        >
                          Forgot?
                        </button>
                      </div>
                      <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={INPUT_CLASS}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign in"
                      )}
                    </button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-black/20 px-3 uppercase tracking-wider text-gray-500">
                        Or
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="liquid-glass inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-medium disabled:opacity-60"
                  >
                    <GoogleIcon />
                    Sign in with Google
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="register">
                <div className="liquid-glass rounded-2xl p-6 md:p-8">
                  <h1
                    className="text-3xl font-normal tracking-[-0.04em] md:text-4xl"
                  >
                    Create your{" "}
                    <span className="italic font-light text-gray-300">
                      account.
                    </span>
                  </h1>
                  <p className="mt-2 text-sm text-gray-400">
                    Sign up free — no card required.
                  </p>

                  {error && (
                    <div
                      role="alert"
                      className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm text-red-200"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="register-email"
                        className="text-xs font-medium uppercase tracking-wider text-gray-400"
                      >
                        Email
                      </label>
                      <input
                        id="register-email"
                        type="email"
                        placeholder="name@example.com"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="register-password"
                        className="text-xs font-medium uppercase tracking-wider text-gray-400"
                      >
                        Password
                      </label>
                      <input
                        id="register-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="confirm-password"
                        className="text-xs font-medium uppercase tracking-wider text-gray-400"
                      >
                        Confirm password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={INPUT_CLASS}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Create account"
                      )}
                    </button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-black/20 px-3 uppercase tracking-wider text-gray-500">
                        Or
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="liquid-glass inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-medium disabled:opacity-60"
                  >
                    <GoogleIcon />
                    Sign up with Google
                  </button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="hidden md:block">
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span className="h-px w-8 bg-white/20" aria-hidden="true" />
              Why sign in
            </div>
            <h2
              className="text-3xl font-normal tracking-[-0.04em] md:text-4xl"
            >
              Save what you{" "}
              <span className="italic font-light text-gray-400">create.</span>
            </h2>
            <ul className="mt-8 space-y-4">
              {[
                {
                  title: "Free to start",
                  body: "Sign up free, try a coloring page — no card required.",
                },
                {
                  title: "Saved to your library",
                  body: "Every reading is saved to your dashboard — re-download any time.",
                },
                {
                  title: "No subscription",
                  body: "Top up only when you want another reading. Nothing auto-renews.",
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="liquid-glass flex items-start gap-3 rounded-xl p-4"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="mt-0.5 text-sm text-gray-400">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Story In Color. All rights reserved.
          </p>
          <nav className="flex gap-6">
            <Link
              href="/terms"
              className="text-xs text-gray-500 transition-colors hover:text-white"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-gray-500 transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/contact"
              className="text-xs text-gray-500 transition-colors hover:text-white"
            >
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
