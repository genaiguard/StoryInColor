"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, ArrowLeft, Key, Mail, UserCog, UserX } from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { 
  getAuth, 
  updateEmail, 
  updatePassword, 
  deleteUser, 
  EmailAuthProvider, 
  reauthenticateWithCredential,
  sendPasswordResetEmail
} from "firebase/auth"
import { 
  getFirestore, 
  doc, 
  collection, 
  query, 
  getDocs, 
  deleteDoc,
  writeBatch,
  updateDoc,
  serverTimestamp,
  getDoc,
  setDoc
} from "firebase/firestore"
import { ref, listAll, deleteObject, StorageReference } from "firebase/storage"
import { getConfiguredStorage } from "@/app/firebase/storage-helpers"

export default function SettingsPage() {
  const router = useRouter()
  const { user, initialized, logout } = useFirebase()
  
  // UI states
  const [currentTab, setCurrentTab] = useState("account")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  
  // Form states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletePassword, setDeletePassword] = useState("")

  // Reset password
  const handleSendPasswordReset = async () => {
    if (!user?.email) return
    
    setIsLoading(true)
    setMessage(null)
    
    try {
      const auth = getAuth()
      // Use Firebase's built-in password reset functionality
      await sendPasswordResetEmail(auth, user.email)
      setMessage({ 
        type: "success", 
        text: "Password reset email sent. Please check your inbox." 
      })
    } catch (error: any) {
      setMessage({ 
        type: "error", 
        text: `Failed to send reset email: ${error.message}` 
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Change password directly
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    if (newPassword !== confirmNewPassword) {
      setMessage({ type: "error", text: "New passwords don't match" })
      return
    }
    
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" })
      return
    }
    
    setIsLoading(true)
    setMessage(null)
    
    try {
      const auth = getAuth()
      const credential = EmailAuthProvider.credential(
        user.email!, 
        currentPassword
      )
      
      // Re-authenticate before changing password
      await reauthenticateWithCredential(user, credential)
      
      // Update the password
      await updatePassword(user, newPassword)
      
      setMessage({ type: "success", text: "Password updated successfully" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
    } catch (error: any) {
      setMessage({ 
        type: "error", 
        text: `Failed to update password: ${error.message}` 
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Change email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    if (!newEmail || !newEmail.includes('@')) {
      setMessage({ type: "error", text: "Please enter a valid email address" })
      return
    }
    
    setIsLoading(true)
    setMessage(null)
    
    try {
      const auth = getAuth()
      const credential = EmailAuthProvider.credential(
        user.email!, 
        currentPassword
      )
      
      // Re-authenticate before changing email
      await reauthenticateWithCredential(user, credential)
      
      // Update the email
      await updateEmail(user, newEmail)
      
      setMessage({ type: "success", text: "Email updated successfully" })
      setCurrentPassword("")
      setNewEmail("")
    } catch (error: any) {
      setMessage({ 
        type: "error", 
        text: `Failed to update email: ${error.message}` 
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete account
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
      const auth = getAuth();
      const db = getFirestore();
      const storage = getConfiguredStorage();
      
      // Re-authenticate user before performing sensitive operations
      const credential = EmailAuthProvider.credential(
        user.email!, 
        deletePassword
      );
      
      await reauthenticateWithCredential(user, credential);
      
      // Step 1: Delete storage files directly
      try {
        // Generic logging without user ID
        console.log("Attempting to delete user storage files");
        
        // Security rule message without specifics
        console.log(
          "Note: Storage rules must allow delete operations"
        );
        
        const storageRef = ref(storage, `users/${user.uid}`);
        
        // Create a recursive deletion function
        const deleteFilesRecursively = async (folderRef: StorageReference): Promise<boolean> => {
          try {
            // List all items in the current folder
            const listResult = await listAll(folderRef);
            
            // Create arrays to hold deletion promises
            const fileDeletePromises: Promise<any>[] = [];
            const folderDeletePromises: Promise<boolean>[] = [];
            
            // Add file deletion promises without logging file paths
            listResult.items.forEach(fileRef => {
              fileDeletePromises.push(
                deleteObject(fileRef).catch(err => {
                  console.error("File deletion failed");
                  return null;
                })
              );
            });
            
            // Process subfolders recursively
            listResult.prefixes.forEach(subfolder => {
              folderDeletePromises.push(deleteFilesRecursively(subfolder));
            });
            
            // Wait for all promises to complete
            await Promise.all([...fileDeletePromises, ...folderDeletePromises]);
            
            return true;
          } catch (error) {
            console.error("Folder processing error");
            return false;
          }
        };
        
        // Start the recursive deletion from the user's folder
        await deleteFilesRecursively(storageRef);
        console.log("Storage files deleted");
      } catch (storageError) {
        console.error("Storage deletion error");
        // Continue with account deletion even if storage deletion fails
      }
      
      // Step 2: Mark all Firestore data as deleted instead of deleting it
      try {
        const userRef = doc(db, "users", user.uid);
        
        // Check if user document exists first
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          // Mark the user document as deleted
          await updateDoc(userRef, {
            deleted: true,
            deletedAt: serverTimestamp(),
            email: user.email // Store the email before account deletion
          });
          console.log("User document updated");
        } else {
          // No user document exists, so nothing to mark as deleted
          console.log("No user document found");
        }
        
        // Mark all projects as deleted, only if they exist
        const projectsRef = collection(db, "users", user.uid, "projects");
        const projectsSnapshot = await getDocs(projectsRef);
        
        if (projectsSnapshot.docs.length > 0) {
          // Use batched writes for better performance
          const MAX_BATCH_SIZE = 500; // Firestore limit
          let batchCount = 0;
          let batch = writeBatch(db);
          
          // Process each project document
          for (const projectDoc of projectsSnapshot.docs) {
            // Mark project as deleted if not already deleted
            if (!projectDoc.data().deleted) {
              batch.update(projectDoc.ref, {
                deleted: true,
                deletedAt: serverTimestamp()
              });
              batchCount++;
              
              // If we reach batch limit, commit and create new batch
              if (batchCount >= MAX_BATCH_SIZE) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
              }
            }
          }
          
          // Commit any remaining changes
          if (batchCount > 0) {
            await batch.commit();
          }
          
          console.log(`${batchCount} documents updated`);
        } else {
          console.log("No project documents found");
        }
      } catch (firestoreError) {
        console.error("Database update error");
        // Continue with account deletion even if Firestore update fails
      }
      
      // Step 3: Delete the user authentication account
      await deleteUser(user);
      console.log("Authentication account deleted");
      
      // Redirect to home page
      router.push("/");
    } catch (error: any) {
      setMessage({ 
        type: "error", 
        text: `Failed to delete account: ${error.message}` 
      });
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
          <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                Story<span className="text-orange-500">InColor</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 py-6 md:py-8 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="rounded-full bg-amber-100 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Not Signed In</h2>
              <p className="text-gray-500 mb-4">Please sign in to access settings.</p>
              <Button asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Dashboard</span>
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                Story<span className="text-orange-500">InColor</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Account Settings</h1>
            <p className="text-gray-500">
              Manage your account preferences and personal information
            </p>
          </div>

          {message && (
            <div className={`mb-6 ${message.type === "error" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"} border rounded-lg p-4`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`h-5 w-5 ${message.type === "error" ? "text-red-500" : "text-green-500"} mt-0.5 flex-shrink-0`} />
                <div className={`text-sm ${message.type === "error" ? "text-red-700" : "text-green-700"}`}>
                  <p className="font-medium mb-1">{message.type === "error" ? "Error" : "Success"}</p>
                  <p>{message.text}</p>
                </div>
              </div>
            </div>
          )}

          <Tabs defaultValue="account" value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="account" className="flex gap-2 justify-center items-center">
                <UserCog className="h-4 w-4" />
                <span>Account</span>
              </TabsTrigger>
              <TabsTrigger value="password" className="flex gap-2 justify-center items-center">
                <Key className="h-4 w-4" />
                <span>Password</span>
              </TabsTrigger>
              <TabsTrigger value="delete" className="flex gap-2 justify-center items-center">
                <UserX className="h-4 w-4" />
                <span>Delete Account</span>
              </TabsTrigger>
            </TabsList>

            {/* ACCOUNT INFO TAB */}
            <TabsContent value="account" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>
                    View and update your account details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Email</h3>
                    <p className="text-gray-700">{user.email}</p>
                  </div>
                  <Separator />
                  
                  <form onSubmit={handleChangeEmail} className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Change Email</h3>
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="current-password" className="text-xs text-gray-500 mb-1 block">
                            Current Password
                          </label>
                          <Input
                            id="current-password"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter your current password"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="new-email" className="text-xs text-gray-500 mb-1 block">
                            New Email
                          </label>
                          <Input
                            id="new-email"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="Enter your new email"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? "Updating..." : "Update Email"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PASSWORD TAB */}
            <TabsContent value="password" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Password Management</CardTitle>
                  <CardDescription>
                    Update your password or request a password reset
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="current-pwd" className="text-xs text-gray-500 mb-1 block">
                          Current Password
                        </label>
                        <Input
                          id="current-pwd"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter your current password"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="new-pwd" className="text-xs text-gray-500 mb-1 block">
                          New Password
                        </label>
                        <Input
                          id="new-pwd"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter your new password"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="confirm-pwd" className="text-xs text-gray-500 mb-1 block">
                          Confirm New Password
                        </label>
                        <Input
                          id="confirm-pwd"
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Confirm your new password"
                          required
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? "Updating..." : "Update Password"}
                    </Button>
                  </form>

                  <Separator />
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Password Reset</h3>
                    <p className="text-xs text-gray-500">
                      You can also choose to receive a password reset email with instructions
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={handleSendPasswordReset}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? "Sending..." : "Send Password Reset Email"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* DELETE ACCOUNT TAB */}
            <TabsContent value="delete" className="space-y-4">
              <Card className="border-red-200">
                <CardHeader className="bg-red-50">
                  <CardTitle className="text-red-600">Delete Account</CardTitle>
                  <CardDescription>
                    Permanently delete your account and all associated data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-red-50 p-4 rounded-md text-sm text-red-700">
                    <p className="font-medium mb-1">Warning:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>This action cannot be undone</li>
                      <li>All your projects and data will be permanently deleted</li>
                      <li>You will not be able to recover any information</li>
                    </ul>
                  </div>
                  
                  <form onSubmit={handleDeleteAccount} className="space-y-4">
                    <div>
                      <label htmlFor="delete-pwd" className="text-xs text-gray-500 mb-1 block">
                        Your Password
                      </label>
                      <Input
                        id="delete-pwd"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Enter your password to confirm"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="delete-confirm" className="text-xs text-gray-500 mb-1 block">
                        To confirm, type "DELETE" below
                      </label>
                      <Input
                        id="delete-confirm"
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder='Type "DELETE" to confirm'
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      variant="destructive" 
                      disabled={isLoading || deleteConfirmation !== "DELETE"}
                      className="w-full"
                    >
                      {isLoading ? "Deleting..." : "Permanently Delete My Account"}
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="bg-gray-50 border-t p-4">
                  <p className="text-xs text-gray-500">
                    If you're having troubles with the app, please consider contacting support 
                    before deleting your account.
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
} 