"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  AlertCircle, 
  RefreshCw, 
  Search, 
  User, 
  Users, 
  DollarSign, 
  CreditCard, 
  Image as ImageIcon, 
  Wand2,
  FileText,
  ArrowUp,
  ArrowDown
} from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFunctions, httpsCallable } from "firebase/functions"
import { toast } from "sonner"

// --- Type Definitions (Matching Cloud Function Response) ---
interface AggregatedStats {
  totalUsers: number;
  totalRevenue: number; // In dollars
  payingCustomers: number;
  totalUploads: number;
  totalGenerations: number;
  totalPdfGenerations: number;
}

interface UserProjectSummary {
  id: string;
  title: string;
  pageCount: number;
}

interface EnrichedUser {
  id: string; // Firebase Auth UID
  email: string | null;
  displayName: string | null;
  createdAt: string; // ISO string format (User creation)
  disabled: boolean; // Added
  deleted: boolean; // Added
  creditBalance: number;
  totalSpent: number; // In dollars
  projectCount: number;
  pdfGeneratedCount: number;
  latestProjectCreatedAt: string | null;
  projects: UserProjectSummary[]; // Contains {id, title, pageCount}
}

interface AdminDashboardData {
  success: boolean;
  aggregatedStats?: AggregatedStats; // Make optional for initial state
  users?: EnrichedUser[]; // Make optional for initial state
  message?: string;
  error?: string;
}

// Admin emails allowed to access this interface .
const ADMIN_EMAILS = ['ipekcioglu@me.com'];

type SortKey = 'userCreatedAt' | 'lastProjectCreatedAt' | 'email' | 'totalSpent';
type SortDirection = 'asc' | 'desc';

export default function AdminPage() {
  // --- State Variables ---
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyUsersWithProjects, setShowOnlyUsersWithProjects] = useState(false);
  const [showOnlyPaidUsers, setShowOnlyPaidUsers] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('userCreatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const { user, initialized } = useFirebase() || { user: null, initialized: false };
  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');
  
  // --- Data Fetching Effect ---
  useEffect(() => {
    if (!initialized || !user || !isAdmin) {
      if (initialized && user && !isAdmin) {
        setError("You don't have permission to access this page.");
      }
      setLoading(false);
      return;
    }
    
    const loadAdminData = async () => {
      setLoading(true);
      setError("");
      if (process.env.NODE_ENV !== "production") console.log("[Admin Page] Calling getAdminDashboardData function...");
      
      try {
        const functions = getFunctions();
        const getAdminDataFn = httpsCallable<unknown, AdminDashboardData>(functions, 'getAdminDashboardData');
        const result = await getAdminDataFn();
        const data = result.data;

        if (data.success && data.aggregatedStats && data.users) {
          if (process.env.NODE_ENV !== "production") console.log("[Admin Page] Received data:", data);
          setStats(data.aggregatedStats);
          setUsers(data.users);
        } else {
          console.error("[Admin Page] Failed to load admin data:", data.message || data.error);
          setError(data.message || data.error || "Failed to load admin dashboard data.");
        }
      } catch (err) {
        console.error("[Admin Page] Error calling getAdminDashboardData:", err);
        setError(`An error occurred: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadAdminData();
  }, [initialized, user, isAdmin]);
  
  // --- Filtering & Sorting Logic (Using useMemo for efficiency) ---
  const processedUsers = useMemo(() => {
    let processed = users;

    // Apply Filters
    if (showOnlyUsersWithProjects) {
      processed = processed.filter(userData => userData.projectCount > 0);
    }
    if (showOnlyPaidUsers) {
      processed = processed.filter(userData => userData.totalSpent > 0);
    }

    // Apply Search Term
    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        processed = processed.filter(userData => 
            (userData.email && userData.email.toLowerCase().includes(lowerSearchTerm)) ||
            (userData.displayName && userData.displayName.toLowerCase().includes(lowerSearchTerm)) ||
            userData.projects.some(project => project.title.toLowerCase().includes(lowerSearchTerm)) ||
            userData.id.toLowerCase().includes(lowerSearchTerm)
        );
    }

    // Apply Sorting
    processed.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'userCreatedAt':
          comparison = (new Date(a.createdAt)).getTime() - (new Date(b.createdAt)).getTime();
          break;
        case 'lastProjectCreatedAt':
          const dateA = a.latestProjectCreatedAt ? new Date(a.latestProjectCreatedAt).getTime() : 0;
          const dateB = b.latestProjectCreatedAt ? new Date(b.latestProjectCreatedAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '');
          break;
        case 'totalSpent':
          comparison = a.totalSpent - b.totalSpent;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return processed;
  }, [users, showOnlyUsersWithProjects, showOnlyPaidUsers, searchTerm, sortBy, sortDirection]);
  
  // --- Render Logic ---

  // Loading State
  if (loading && (!initialized || !user || !isAdmin)) {
     // Show minimal loading if auth state is not ready
     return <MinimalLoadingState />;
  }
  if (loading) {
     return <FullPageLoadingState message="Loading Admin Dashboard..." />;
  }

  // Access Denied / Not Signed In States (Keep as is)
  if (initialized && user && !isAdmin) {
    return <AccessDeniedState />;
  }
  if (initialized && !user) {
    return <NotSignedInState />;
  }

  // Main Admin Dashboard Render
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header (Keep as is) */}
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
          {/* Top Header Section (Keep as is) */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-gray-500">Overview of users, projects, and revenue</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search users or projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()} // Simple reload for now
                title="Refresh Data"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Error Display (Keep as is) */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">Error Loading Data</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Aggregated Stats Section - Add PDF Count */}
          {stats && (
            <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard title="Total Users" value={stats.totalUsers.toLocaleString()} icon={Users} />
              <StatCard title="Paying Customers" value={stats.payingCustomers.toLocaleString()} icon={CreditCard} />
              <StatCard title="Total Revenue" value={`$${stats.totalRevenue.toFixed(2)}`} icon={DollarSign} />
              <StatCard title="Images Uploaded" value={stats.totalUploads.toLocaleString()} icon={ImageIcon} />
              <StatCard title="Images Generated" value={stats.totalGenerations.toLocaleString()} icon={Wand2} />
              <StatCard title="PDFs Generated" value={stats.totalPdfGenerations.toLocaleString()} icon={FileText} />
            </div>
          )}
          
          {/* --- NEW Filter and Sort Controls --- */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Filters & Sorting</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-6">
              {/* Filters */}
              <div className="space-y-3">
                  <Label className="font-medium">Filters</Label>
                  <div className="flex items-center space-x-2">
                      <Checkbox 
                          id="filter-projects" 
                          checked={showOnlyUsersWithProjects} 
                          onCheckedChange={(checked) => setShowOnlyUsersWithProjects(Boolean(checked))}
                      />
                      <Label htmlFor="filter-projects" className="text-sm font-normal cursor-pointer">Has Projects</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                      <Checkbox 
                          id="filter-paid" 
                          checked={showOnlyPaidUsers} 
                          onCheckedChange={(checked) => setShowOnlyPaidUsers(Boolean(checked))}
                      />
                      <Label htmlFor="filter-paid" className="text-sm font-normal cursor-pointer">Is Paying User</Label>
                  </div>
              </div>
              {/* Sorting */}
              <div className="flex-1 space-y-3">
                  <Label htmlFor="sort-by" className="font-medium">Sort By</Label>
                  <div className="flex gap-2">
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
                          <SelectTrigger id="sort-by" className="w-full md:w-[200px]">
                              <SelectValue placeholder="Select sort field" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="userCreatedAt">User Created Date</SelectItem>
                              <SelectItem value="lastProjectCreatedAt">Last Project Date</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="totalSpent">Total Spent</SelectItem>
                          </SelectContent>
                      </Select>
                      <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')} 
                          title={`Sort direction: ${sortDirection === 'asc' ? 'Ascending' : 'Descending'}`}
                      >
                          {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      </Button>
                  </div>
              </div>
            </CardContent>
          </Card>

          {/* User List Section */}
          {loading ? (
            // Show spinner only if already past initial auth loading
            <div className="flex justify-center items-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : processedUsers.length > 0 ? (
            <div className="space-y-8">
              {processedUsers.map((userData) => (
                <UserDetailCard key={userData.id} userData={userData} />
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
                  {searchTerm ? "No users match your search criteria." : "No users have been created yet or data is still loading."}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer (Keep as is) */}
      <footer className="border-t bg-white mt-8">
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 md:gap-2">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  Story<span className="text-orange-500">InColor</span>
                </span>
              </Link>
              <p className="text-xs text-gray-500">© {new Date().getFullYear()} StoryInColor. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// --- Helper Components ---

// Simple loading state for when auth is initializing
const MinimalLoadingState = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
);

// Full page loading state
const FullPageLoadingState = ({ message }: { message: string }) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
      <p className="text-gray-500">{message}</p>
    </div>
  </div>
);

// Access Denied Component
const AccessDeniedState = () => (
  <div className="flex min-h-screen flex-col bg-gray-50">
    {/* Basic Header */} 
    <header className="border-b bg-white"><div className="container mx-auto h-16 flex items-center px-4"><Link href="/"><span className="text-xl font-bold">Story<span className="text-orange-500">InColor</span></span></Link></div></header>
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center p-6">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-gray-500 mb-4">You don't have permission to access this page.</p>
        <Button asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
      </div>
    </main>
  </div>
);

// Not Signed In Component
const NotSignedInState = () => (
  <div className="flex min-h-screen flex-col bg-gray-50">
     {/* Basic Header */} 
    <header className="border-b bg-white"><div className="container mx-auto h-16 flex items-center px-4"><Link href="/"><span className="text-xl font-bold">Story<span className="text-orange-500">InColor</span></span></Link></div></header>
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center p-6">
        <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Not Signed In</h2>
        <p className="text-gray-500 mb-4">Please sign in to access the admin dashboard.</p>
        <Button asChild><Link href="/login">Sign In</Link></Button>
      </div>
    </main>
  </div>
);

// Stat Card Component
const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> */}
    </CardContent>
  </Card>
);

// User Detail Card Component (Updated with Disabled/Deleted status)
const UserDetailCard = ({ userData }: { userData: EnrichedUser }) => (
  <div key={userData.id} className={`rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden ${userData.disabled || userData.deleted ? 'opacity-60 bg-gray-100' : ''}`}>
    {/* User Header (Updated tags) */}
    <div className={`p-4 border-b ${userData.disabled || userData.deleted ? 'bg-gray-100' : 'bg-gray-50'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        {/* User Info (Email, ID, Created Date) */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="rounded-full bg-blue-100 p-2 flex-shrink-0">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold truncate" title={userData.email || userData.id}>
                {userData.email || "No Email Available"}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                {userData.displayName ? <span title={userData.displayName}>{userData.displayName} • </span> : ''}
                <span className="text-xs">ID: <span className="font-mono" title={userData.id}>{userData.id}</span></span>
                {` • Created: ${new Date(userData.createdAt).toLocaleDateString()}`}
              </p>
            </div>
        </div>
        {/* Status Tags */}
        <div className="flex flex-wrap gap-2 flex-shrink-0 mt-2 md:mt-0 items-center">
            {/* Deleted/Disabled Badges */}
            {userData.deleted && (
                <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded border border-red-300">Soft Deleted</span>
            )}
            {userData.disabled && (
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded border border-yellow-300">Account Disabled</span>
            )}
            {/* Other stats */}
            <div className="bg-blue-100 px-3 py-1 rounded-full text-center" title={`${userData.projectCount} projects created`}>
                <p className="text-xs text-blue-800 font-medium">{userData.projectCount} Project{userData.projectCount !== 1 ? 's' : ''}</p>
            </div>
             <div className="bg-purple-100 px-3 py-1 rounded-full text-center" title={`${userData.pdfGeneratedCount} PDFs generated`}>
                <p className="text-xs text-purple-800 font-medium">{userData.pdfGeneratedCount} PDF{userData.pdfGeneratedCount !== 1 ? 's' : ''}</p>
            </div>
             <div className="bg-green-100 px-3 py-1 rounded-full text-center" title={`$${userData.totalSpent.toFixed(2)} spent`}>
                <p className="text-xs text-green-800 font-medium">${userData.totalSpent.toFixed(2)} Spent</p>
            </div>
             <div className="bg-yellow-100 px-3 py-1 rounded-full text-center" title={`${userData.creditBalance} credits remaining`}>
                <p className="text-xs text-yellow-800 font-medium">{userData.creditBalance} Credits</p>
            </div>
        </div>
      </div>
    </div>
    
    {/* Projects List */}
    <div className="p-4">
      <h4 className="text-sm font-medium mb-3">Recent Projects ({userData.projects.length > 0 ? `showing up to ${userData.projects.length}` : '0'})</h4>
      {userData.projects.length > 0 ? (
        <div className="space-y-3">
          {userData.projects.map(project => (
            <div key={project.id} className="flex items-center justify-between border p-3 rounded-md bg-white">
              <div>
                <Link href={`/admin/projects?id=${project.id}&userId=${userData.id}`} className="text-sm font-medium text-blue-600 hover:underline hover:text-blue-800">
                  {project.title}
                </Link>
                 <p className="text-xs text-gray-500">Pages: {project.pageCount} • ID: <span className="font-mono">{project.id}</span></p>
              </div>
               <Link href={`/admin/projects?id=${project.id}&userId=${userData.id}`} className="ml-4">
                  <Button size="sm" variant="outline">Manage</Button>
               </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm italic">No projects found for this user.</p>
      )}
    </div>
  </div>
); 