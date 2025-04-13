"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { 
  AlertCircle, 
  ArrowLeft, 
  Download,
  Eye, 
  RefreshCw, 
  Search, 
  User,
  UploadCloud
} from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, collection, getDocs, query, doc, getDoc, collectionGroup } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import { toast } from "sonner"
import Image from "next/image"
import { getStorage, ref, getDownloadURL } from "firebase/storage"
import { getConfiguredStorage } from "@/app/firebase/storage-helpers"

// Define the shapes of the responses from our cloud functions
interface AuthUserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  // other fields...
}

interface ListUsersResponse {
  success: boolean;
  users?: AuthUserData[];
  pageToken?: string;
  message?: string;
  error?: string;
}

interface GetUserDataResponse {
  success: boolean;
  userData?: AuthUserData;
  message?: string;
  error?: string;
}

// Function to fetch all users from Firebase Auth
const fetchAllUsers = async (user: any): Promise<AuthUserData[] | null> => {
  try {
    if (!user) return null;
    
    const functions = getFunctions();
    const listAllUsersFn = httpsCallable<{ pageSize?: number, pageToken?: string }, ListUsersResponse>(
      functions, 
      'listAllUsers'
    );
    
    let allUsers: AuthUserData[] = [];
    let pageToken: string | undefined;
    let moreUsers = true;
    
    // Paginate through all users
    while (moreUsers) {
      const result = await listAllUsersFn({ pageSize: 1000, pageToken });
      
      if (result.data.success && result.data.users) {
        allUsers = [...allUsers, ...result.data.users];
        
        if (result.data.pageToken) {
          pageToken = result.data.pageToken;
        } else {
          moreUsers = false;
        }
      } else {
        console.error('Error fetching users:', result.data.message);
        moreUsers = false;
      }
    }
    
    return allUsers;
  } catch (error) {
    console.error('Error calling listAllUsers:', error);
    return null;
  }
};

// Function to fetch a single user's data from Firebase Auth
const fetchUserData = async (userId: string, user: any): Promise<AuthUserData | null> => {
  try {
    if (!user) return null;
    
    const functions = getFunctions();
    const getUserDataFn = httpsCallable<{ userId: string }, GetUserDataResponse>(
      functions, 
      'getAuthUserData'
    );
    
    const result = await getUserDataFn({ userId });
    
    if (result.data.success && result.data.userData) {
      return result.data.userData;
    } else {
      console.error('Error fetching user data:', result.data.message);
      return null;
    }
  } catch (error) {
    console.error('Error calling getAuthUserData:', error);
    return null;
  }
};

// Define types
interface UserData {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  projects: ProjectData[];
}

interface ProjectData {
  id: string;
  title: string;
  productType: string;
  createdAt: string;
  hasProcessedImage: boolean;
  artStyle?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  status?: string;
}

// Admin emails allowed to access this interface
const ADMIN_EMAILS = ['ipekcioglu@me.com']; // Add any additional admin emails here

export default function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Initialize Firebase context
  const firebaseContext = useFirebase();
  const { user, initialized } = firebaseContext || { user: null, initialized: false };
  
  // Check if current user is an admin
  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');
  
  // Load users and their projects from Firestore
  useEffect(() => {
    if (!initialized || !user || !isAdmin) {
      if (initialized && user && !isAdmin) {
        setError("You don't have permission to access this page.");
      }
      setLoading(false);
      return;
    }
    
    const loadUsers = async () => {
      setLoading(true);
      setError("");
      
      try {
        console.log("Starting to load users data as admin:", user?.email);
        const db = getFirestore();
        
        // Step 1: First get all projects and organize by user ID
        console.log("Fetching projects via collectionGroup");
        const projectsQuery = query(collectionGroup(db, "projects"));
        const projectsSnapshot = await getDocs(projectsQuery);
        
        console.log(`Found ${projectsSnapshot.docs.length} projects total`);
        
        // Organize projects by userId
        const userProjects = new Map<string, ProjectData[]>();
        const userIds = new Set<string>();
        
        projectsSnapshot.docs.forEach(doc => {
          // Extract userId from path: users/{userId}/projects/{projectId}
          const pathParts = doc.ref.path.split('/');
          const userId = pathParts[1];
          
          if (!userId) return;
          
          userIds.add(userId);
          
          const projectData = doc.data();
          const project: ProjectData = {
            id: doc.id,
            title: projectData.title || "Untitled Project",
            productType: projectData.productType || "standard",
            status: projectData.status || "preview",
            createdAt: projectData.createdAt ? 
              new Date(projectData.createdAt.toDate()).toLocaleDateString() : 
              "Unknown date",
            hasProcessedImage: projectData.hasProcessedImage || false,
            artStyle: projectData.artStyle || undefined,
            thumbnailPath: projectData.thumbnailPath || undefined
          };
          
          if (!userProjects.has(userId)) {
            userProjects.set(userId, []);
          }
          
          userProjects.get(userId)?.push(project);
        });
        
        console.log(`Found ${userIds.size} unique users with projects`);
        
        // Fetch thumbnail URLs for projects that have thumbnailPaths but no URLs
        Array.from(userIds).forEach(async (userId) => {
          const projects = userProjects.get(userId) || [];
          for (const project of projects) {
            if (project.thumbnailPath && !project.thumbnailUrl) {
              try {
                const storage = getConfiguredStorage();
                const imageRef = ref(storage, project.thumbnailPath);
                project.thumbnailUrl = await getDownloadURL(imageRef);
              } catch (error) {
                console.error(`Error getting thumbnail URL for project ${project.id}:`, error);
              }
            }
          }
        });
        
        // Step 2: Now get user details using our cloud function
        const functions = getFunctions();
        const listAllUsers = httpsCallable(functions, 'listAllUsers');
        
        // Create placeholder user data with projects
        const usersData: UserData[] = Array.from(userIds).map(userId => {
          return {
            id: userId,
            email: "Loading...", // Temporary placeholder
            createdAt: "Unknown date",
            projects: userProjects.get(userId) || []
          };
        });
        
        try {
          // Call the cloud function to get all users
          console.log("Calling listAllUsers function");
          const result = await listAllUsers({});
          const response = result.data as any;
          
          if (response.success) {
            console.log(`Function returned ${response.users.length} users`);
            
            // Update user data with authentication information
            response.users.forEach(authUser => {
              // Find the matching user in our array
              const userIndex = usersData.findIndex(u => u.id === authUser.uid);
              if (userIndex !== -1) {
                usersData[userIndex].email = authUser.email || usersData[userIndex].email;
                usersData[userIndex].displayName = authUser.displayName;
                usersData[userIndex].createdAt = authUser.createdAt || usersData[userIndex].createdAt;
              }
            });
          } else {
            console.warn("Error getting auth users:", response.error);
            // Continue with existing data, we'll try to get Firestore data for users instead
          }
        } catch (err) {
          console.error("Error calling listAllUsers function:", err);
          // Continue with existing data, we'll try to get Firestore data for users instead
        }
        
        // Step 3: For any users still missing details, try to get from Firestore
        const userDataPromises = usersData.map(async userData => {
          // Skip users that already have emails (from Auth)
          if (userData.email !== "Loading...") return userData;
          
          try {
            console.log(`Trying to get Firestore data for user ${userData.id}`);
            const userDoc = await getDoc(doc(db, "users", userData.id));
            
            if (userDoc.exists()) {
              console.log(`User document exists for ${userData.id}`);
              const userInfo = userDoc.data();
              
              // Check all possible locations for the email
              if (userInfo.email) {
                userData.email = userInfo.email;
              } else if (userInfo.userEmail) {
                userData.email = userInfo.userEmail;
              } else if (userInfo.providerData && userInfo.providerData[0]?.email) {
                userData.email = userInfo.providerData[0].email;
              } else if (userInfo.auth && userInfo.auth.email) {
                userData.email = userInfo.auth.email;
              } else {
                userData.email = userData.id; // Fallback to ID
              }
              
              userData.displayName = userInfo.displayName || userInfo.name || null;
              userData.createdAt = userInfo.createdAt ? 
                new Date(userInfo.createdAt.toDate()).toLocaleDateString() : 
                "Unknown date";
            } else {
              console.log(`User document does NOT exist for ${userData.id}`);
              userData.email = userData.id; // Use ID as fallback
            }
          } catch (err) {
            console.warn(`Couldn't fetch details for user ${userData.id}:`, err);
          }
          
          return userData;
        });
        
        const enhancedUsersData = await Promise.all(userDataPromises);
        console.log("Processed user data:", enhancedUsersData.length);
        
        setUsers(enhancedUsersData);
      } catch (error) {
        console.error("Error loading users:", error);
        setError("Failed to load users data. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();
  }, [initialized, user, isAdmin]);
  
  // Filter based on search term
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    user.projects.some(project => project.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // If user is not an admin, show access denied
  if (initialized && user && !isAdmin) {
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
              <div className="rounded-full bg-red-100 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Access Denied</h2>
              <p className="text-gray-500 mb-4">You don't have permission to access this page.</p>
              <Button asChild>
                <Link href="/dashboard">Return to Dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // If user is not logged in, show not signed in
  if (initialized && !user) {
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
              <p className="text-gray-500 mb-4">Please sign in to access this page.</p>
              <Button asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b sticky top-0 bg-white z-50 shadow-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              Story<span className="text-orange-500">InColor</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3 md:gap-6">
            <Link href="/dashboard" className="text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/admin" className="text-sm font-medium text-orange-500">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-gray-500">Manage users and their projects</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search users and projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-8">
              {filteredUsers.map((userData) => (
                <div key={userData.id} className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                  {/* User header */}
                  <div className="bg-blue-50 p-4 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-blue-100 p-2">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">
                            {userData.email !== userData.id ? userData.email : "No Email Available"}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {userData.displayName ? `${userData.displayName} • ` : ''}
                            <span className="text-xs">ID: <span className="font-mono">{userData.id}</span></span> • Created: {userData.createdAt}
                          </p>
                        </div>
                      </div>
                      <div className="bg-blue-100 px-3 py-1 rounded-full">
                        <span className="text-xs text-blue-700 font-medium">
                          {userData.projects.length} Project{userData.projects.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Projects */}
                  <div className="p-4">
                    <h4 className="text-sm font-medium mb-4">Projects ({userData.projects.length})</h4>
                    {userData.projects.length > 0 ? (
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {userData.projects.map(project => (
                          <Card key={project.id} className="overflow-hidden">
                            {project.thumbnailUrl && (
                              <div className="w-full h-40 relative">
                                <Image 
                                  src={project.thumbnailUrl} 
                                  alt={project.title}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <CardHeader className="p-4">
                              <CardTitle className="text-sm">{project.title}</CardTitle>
                              <CardDescription className="text-xs">
                                Created: {project.createdAt}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Product Type:</span>
                                <span>{project.productType}</span>
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-gray-500">Art Style:</span>
                                <span>{project.artStyle || "Classic"}</span>
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-gray-500">Status:</span>
                                <span>
                                  {project.hasProcessedImage ? (
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                      Processed
                                    </span>
                                  ) : (
                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                      Pending
                                    </span>
                                  )}
                                </span>
                              </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                              <Link href={`/admin/projects?id=${project.id}&userId=${userData.id}`} className="w-full">
                                <Button size="sm" variant="default" className="w-full">
                                  Manage Project
                                </Button>
                              </Link>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No projects found for this user.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
              <div className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-blue-100 p-6 mb-4">
                  <User className="h-10 w-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-medium mb-2">No Users Found</h3>
                <p className="text-gray-500 text-center max-w-md mb-6">
                  {searchTerm ? "No users or projects match your search criteria." : "No users have been created yet."}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t bg-white mt-8">
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 md:gap-2">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  Story<span className="text-orange-500">InColor</span>
                </span>
              </Link>
              <p className="text-xs text-gray-500">© 2023 StoryInColor. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 