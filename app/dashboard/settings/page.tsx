"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowLeft,
  Key,
  Loader2,
  UserCog,
  UserX,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useFirebase } from "@/app/firebase/firebase-provider";
import {
  getAuth,
  verifyBeforeUpdateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import {
  ref,
  listAll,
  deleteObject,
  StorageReference,
} from "firebase/storage";
import { getConfiguredStorage } from "@/app/firebase/storage-helpers";
import { getFunctions, httpsCallable } from "firebase/functions";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-gray-500 transition-colors focus:border-white/30 focus:outline-none focus:ring-0";

function PageHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link
          href="/dashboard"
          className="liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <Link
          href="/"
          className="text-base font-semibold tracking-[-0.02em] text-white sm:text-lg"
        >
          <span className="font-light">Story</span>
          <span className="font-semibold">In</span>
          <span className="font-light">Color</span>
        </Link>
      </div>
    </header>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useFirebase();

  const [currentTab, setCurrentTab] = useState("account");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, user.email);
      setMessage({
        type: "success",
        text: "Password reset email sent. Please check your inbox.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to send reset email: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword !== confirmNewPassword) {
      setMessage({ type: "error", text: "New passwords don't match" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setMessage({ type: "success", text: "Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to update password: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!newEmail || !newEmail.includes("@")) {
      setMessage({ type: "error", text: "Please enter a valid email address" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      // Firebase deprecated `updateEmail` in favor of
      // `verifyBeforeUpdateEmail`. The latter sends a verification link to
      // the NEW address; the change only takes effect when the user clicks
      // it. This is also the only path that works once Firebase Auth's
      // "Email Enumeration Protection" is enabled on the project.
      await verifyBeforeUpdateEmail(user, newEmail);

      setMessage({
        type: "success",
        text: `Verification email sent to ${newEmail}. Click the link in that email to complete the change.`,
      });
      setCurrentPassword("");
      setNewEmail("");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to update email: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (deleteConfirmation !== "DELETE") {
      setMessage({ type: "error", text: 'Please type "DELETE" to confirm' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const db = getFirestore();
      const storage = getConfiguredStorage();

      const credential = EmailAuthProvider.credential(
        user.email!,
        deletePassword,
      );
      await reauthenticateWithCredential(user, credential);

      // Step 1: Delete storage files
      try {
        const storageRef = ref(storage, `users/${user.uid}`);
        const deleteFilesRecursively = async (
          folderRef: StorageReference,
        ): Promise<boolean> => {
          try {
            const listResult = await listAll(folderRef);
            const fileDeletePromises: Promise<any>[] = [];
            const folderDeletePromises: Promise<boolean>[] = [];

            listResult.items.forEach((fileRef) => {
              fileDeletePromises.push(
                deleteObject(fileRef).catch(() => null),
              );
            });

            listResult.prefixes.forEach((subfolder) => {
              folderDeletePromises.push(deleteFilesRecursively(subfolder));
            });

            await Promise.all([
              ...fileDeletePromises,
              ...folderDeletePromises,
            ]);
            return true;
          } catch (err) {
            console.error("Folder processing error:", err);
            return false;
          }
        };

        await deleteFilesRecursively(storageRef);
      } catch {
        // Continue with account deletion even if storage deletion fails
      }

      // Step 2: Mark Firestore user doc as deleted
      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          await updateDoc(userRef, {
            deleted: true,
            deletedAt: serverTimestamp(),
            email: user.email,
          });
        }
      } catch {
        // Continue with account deletion even if Firestore update fails
      }

      // Step 3: Disable auth account via Cloud Function
      const functions = getFunctions();
      const disableAccountFn = httpsCallable(
        functions,
        "disableCurrentUserAccount",
      );
      const disableResult = await disableAccountFn();
      if (!(disableResult.data as any)?.success) {
        throw new Error(
          (disableResult.data as any)?.message || "Failed to disable account.",
        );
      }

      if (logout) {
        await logout();
      }

      router.push("/");
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to delete account: ${error.message}`,
      });
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <PageHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="liquid-glass mx-auto max-w-md rounded-2xl p-8 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
              <AlertCircle className="h-6 w-6" />
            </span>
            <h2 className="text-2xl font-normal tracking-[-0.02em]">
              Not signed in
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Please sign in to access settings.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
            >
              Sign in
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <PageHeader />

      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="container mx-auto max-w-3xl">
          <div className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500">
              <span className="h-px w-8 bg-white/20" aria-hidden="true" />
              Settings
            </div>
            <h1
              className="text-3xl font-normal tracking-[-0.04em] sm:text-4xl md:text-5xl"
            >
              Manage your{" "}
              <span className="italic font-light text-gray-400">account.</span>
            </h1>
            <p className="mt-3 text-base text-gray-400 md:text-lg">
              Update your email or password, or close your account.
            </p>
          </div>

          {message && (
            <div
              role={message.type === "error" ? "alert" : "status"}
              className={`mb-6 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                message.type === "error"
                  ? "border-red-500/20 bg-red-500/[0.06] text-red-200"
                  : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200"
              }`}
            >
              {message.type === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              ) : (
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <Tabs
            defaultValue="account"
            value={currentTab}
            onValueChange={setCurrentTab}
            className="space-y-6"
          >
            <TabsList className="grid w-full grid-cols-3 rounded-full bg-white/[0.04] p-1">
              <TabsTrigger
                value="account"
                className="flex items-center justify-center gap-2 rounded-full text-sm text-gray-400 data-[state=active]:bg-white data-[state=active]:text-black"
              >
                <UserCog className="h-4 w-4" />
                <span className="hidden sm:inline">Account</span>
              </TabsTrigger>
              <TabsTrigger
                value="password"
                className="flex items-center justify-center gap-2 rounded-full text-sm text-gray-400 data-[state=active]:bg-white data-[state=active]:text-black"
              >
                <Key className="h-4 w-4" />
                <span className="hidden sm:inline">Password</span>
              </TabsTrigger>
              <TabsTrigger
                value="delete"
                className="flex items-center justify-center gap-2 rounded-full text-sm text-gray-400 data-[state=active]:bg-white data-[state=active]:text-black"
              >
                <UserX className="h-4 w-4" />
                <span className="hidden sm:inline">Delete</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4">
              <div className="liquid-glass rounded-2xl p-6 md:p-8">
                <h2 className="text-xl font-medium text-white">
                  Account information
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  View and update your account details.
                </p>

                <div className="mt-6 space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Current email
                  </h3>
                  <p className="text-sm text-gray-200">{user.email}</p>
                </div>

                <div
                  className="my-6 h-px bg-white/10"
                  aria-hidden="true"
                />

                <form onSubmit={handleChangeEmail} className="space-y-5">
                  <h3 className="text-base font-medium text-white">
                    Change email
                  </h3>
                  <div className="space-y-2">
                    <label
                      htmlFor="current-password"
                      className="text-xs font-medium uppercase tracking-wider text-gray-400"
                    >
                      Current password
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      required
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="new-email"
                      className="text-xs font-medium uppercase tracking-wider text-gray-400"
                    >
                      New email
                    </label>
                    <input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className={INPUT_CLASS}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      "Update email"
                    )}
                  </button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="password" className="space-y-4">
              <div className="liquid-glass rounded-2xl p-6 md:p-8">
                <h2 className="text-xl font-medium text-white">
                  Password
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Change your password or send yourself a reset link.
                </p>

                <form
                  onSubmit={handleChangePassword}
                  className="mt-6 space-y-5"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="current-pwd"
                      className="text-xs font-medium uppercase tracking-wider text-gray-400"
                    >
                      Current password
                    </label>
                    <input
                      id="current-pwd"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="new-pwd"
                      className="text-xs font-medium uppercase tracking-wider text-gray-400"
                    >
                      New password
                    </label>
                    <input
                      id="new-pwd"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="confirm-pwd"
                      className="text-xs font-medium uppercase tracking-wider text-gray-400"
                    >
                      Confirm new password
                    </label>
                    <input
                      id="confirm-pwd"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className={INPUT_CLASS}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      "Update password"
                    )}
                  </button>
                </form>

                <div
                  className="my-6 h-px bg-white/10"
                  aria-hidden="true"
                />

                <div>
                  <h3 className="text-base font-medium text-white">
                    Reset by email
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    Prefer a reset link? We'll email instructions to{" "}
                    {user.email}.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendPasswordReset}
                    disabled={isLoading}
                    className="liquid-glass mt-4 inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {isLoading ? "Sending…" : "Send reset email"}
                  </button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="delete" className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/[0.04]">
                <div className="border-b border-red-500/15 bg-red-500/[0.06] px-6 py-4 md:px-8">
                  <h2 className="text-xl font-medium text-red-100">
                    Delete account
                  </h2>
                  <p className="mt-1 text-sm text-red-200/70">
                    Permanently disable your account and erase your stored
                    photos.
                  </p>
                </div>

                <div className="space-y-5 p-6 md:p-8">
                  <div className="flex items-start gap-3 rounded-xl border border-red-500/15 bg-red-500/[0.04] p-4 text-sm text-red-100">
                    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
                    <div>
                      <p className="font-medium">This cannot be undone</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-red-200/80">
                        <li>All your saved readings will be erased</li>
                        <li>Your uploaded photos will be deleted</li>
                        <li>Your sign-in will be disabled immediately</li>
                      </ul>
                    </div>
                  </div>

                  <form
                    onSubmit={handleDeleteAccount}
                    className="space-y-5"
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor="delete-pwd"
                        className="text-xs font-medium uppercase tracking-wider text-gray-400"
                      >
                        Your password
                      </label>
                      <input
                        id="delete-pwd"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Enter your password to confirm"
                        required
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="delete-confirm"
                        className="text-xs font-medium uppercase tracking-wider text-gray-400"
                      >
                        To confirm, type DELETE
                      </label>
                      <input
                        id="delete-confirm"
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) =>
                          setDeleteConfirmation(e.target.value)
                        }
                        placeholder='Type "DELETE" to confirm'
                        required
                        className={INPUT_CLASS}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        isLoading || deleteConfirmation !== "DELETE"
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        "Permanently delete my account"
                      )}
                    </button>
                  </form>

                  <p className="border-t border-white/5 pt-5 text-xs text-gray-500">
                    If you're having trouble with the app, please consider{" "}
                    <Link
                      href="/contact"
                      className="text-gray-300 transition-colors hover:text-white"
                    >
                      contacting support
                    </Link>{" "}
                    before deleting your account.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
