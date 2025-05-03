"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Package, ShoppingBag, FileDown, RefreshCw, AlertTriangle } from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { toast } from "sonner"

export default function OrderSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  
  const { user, initialized } = useFirebase()
  const [isLoading, setIsLoading] = useState(true)
  const [orderStatus, setOrderStatus] = useState<string>('processing')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string>(sessionId ? sessionId.substring(0, 8).toUpperCase() : '')

  // Load order details from Firestore
  useEffect(() => {
    const loadOrderDetails = async () => {
      if (!initialized || !user || !sessionId) {
        return
      }

      try {
        const db = getFirestore()
        // Query for the project with this payment ID (session ID)
        const q = query(
          collection(db, "users", user.uid, "projects"),
          where("paymentId", "==", sessionId),
          limit(1)
        )

        const querySnapshot = await getDocs(q)
        
        if (querySnapshot.empty) {
          console.log("No project found with paymentId:", sessionId)
          setIsLoading(false)
          return
        }

        const projectDoc = querySnapshot.docs[0]
        const projectData = projectDoc.data()
        
        setProjectId(projectDoc.id)
        setOrderStatus(projectData.status || 'processing')
        setOrderNumber(projectDoc.id.substring(0, 8).toUpperCase())
        
        if (projectData.pdfUrl) {
          setDownloadUrl(projectData.pdfUrl)
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading order details:", error)
        setIsLoading(false)
      }
    }

    // Initial load
    loadOrderDetails()
    
    // Set up polling if PDF is being processed
    const interval = setInterval(() => {
      if (orderStatus === 'processing_pdf' || orderStatus === 'processing') {
        loadOrderDetails()
      }
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
  }, [initialized, user, sessionId, orderStatus])

  // Allow manual refresh of order status
  const handleRefresh = async () => {
    setIsLoading(true)
    toast.info("Checking for updates...")
    
    // Wait a moment to show loading state
    setTimeout(() => {
      setIsLoading(false)
    }, 1500)
  }

  if (!sessionId) {
    // Redirect back to dashboard if no session ID
    useEffect(() => {
      router.push('/dashboard')
    }, [router])
    
    return null
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
        </div>
      </header>

      <main className="flex-1 py-6 md:py-8 px-4 flex items-center justify-center">
        <div className="container mx-auto max-w-3xl">
          {isLoading ? (
            <Card className="w-full border border-blue-200">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-blue-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
                <CardTitle className="text-xl md:text-2xl text-blue-600 mb-2">Loading Order Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 pb-2 px-6">
                <div className="flex items-center justify-center">
                  <p className="text-sm text-gray-600">Retrieving your order information...</p>
                </div>
              </CardContent>
            </Card>
          ) : orderStatus === 'processing_pdf' || orderStatus === 'processing' ? (
            <Card className="w-full border border-amber-200">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-amber-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <RefreshCw className="h-8 w-8 text-amber-600 animate-spin" />
                </div>
                <CardTitle className="text-xl md:text-2xl text-amber-600 mb-2">Processing Your Order</CardTitle>
                <CardDescription>Your PDF is being generated</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 pb-2 px-6">
                <div className="space-y-6">
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-medium mb-2 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-gray-600" /> 
                      Order Details
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      Order Number: <span className="font-medium">{orderNumber}</span>
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      Status: <span className="font-medium capitalize text-amber-600">
                        <RefreshCw className="h-3 w-3 mr-1 inline-block animate-spin" />
                        Processing
                      </span>
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-amber-50">
                    <h3 className="text-lg font-medium mb-2 flex items-center text-amber-700">
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> 
                      PDF Generation in Progress
                    </h3>
                    
                    <p className="text-sm text-gray-600 mb-4">
                      Your coloring book PDF is being generated. The page will automatically update when complete.
                    </p>
                    
                    <Button 
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={handleRefresh}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Check Status
                    </Button>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-center text-gray-600 text-sm mb-4">
                      We've sent a confirmation email with your order details.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 px-6 pb-6">
                <Button className="w-full bg-orange-500 hover:bg-orange-600" asChild>
                  <Link href="/dashboard">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    View Dashboard
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="w-full">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-green-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl md:text-3xl text-green-600 mb-2">Order Confirmed!</CardTitle>
                <CardDescription>Thank you for your purchase</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-2 px-6">
                <div className="space-y-6">
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-medium mb-2 flex items-center">
                      <Package className="h-5 w-5 mr-2 text-gray-600" /> 
                      Order Details
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      Order Number: <span className="font-medium">{orderNumber}</span>
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      Status: <span className="font-medium capitalize">{orderStatus.replace('_', ' ')}</span>
                    </p>
                  </div>
                  
                  {/* PDF Download Section - Only show if completed */}
                  {orderStatus === 'completed' && downloadUrl && (
                    <div className="border rounded-lg p-4 bg-green-50">
                      <h3 className="text-lg font-medium mb-2 flex items-center text-green-700">
                        <FileDown className="h-5 w-5 mr-2" /> 
                        Your PDF is Ready!
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Your coloring pages PDF is ready for download. You can also access this download from your dashboard at any time.
                      </p>
                      <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
                        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download>
                          <FileDown className="mr-2 h-4 w-4" />
                          Download PDF
                        </a>
                      </Button>
                    </div>
                  )}
                  
                  {/* PDF Error Section */}
                  {orderStatus === 'pdf_failed' && (
                    <div className="border-2 rounded-lg p-4 bg-red-50 border-red-200">
                      <h3 className="text-lg font-medium mb-2 flex items-center text-red-700">
                        <AlertTriangle className="h-5 w-5 mr-2" /> 
                        PDF Processing Issue
                      </h3>
                      <p className="text-sm text-gray-700 mb-3">
                        We encountered an issue while generating your PDF. Our team has been notified and will resolve this soon.
                      </p>
                      <Button 
                        className="w-full bg-red-600 hover:bg-red-700"
                        onClick={handleRefresh}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Check Status Again
                      </Button>
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <p className="text-center text-gray-600 text-sm mb-4">
                      We've sent a confirmation email with your order details.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 px-6 pb-6">
                <Button className="w-full bg-orange-500 hover:bg-orange-600" asChild>
                  <Link href="/dashboard">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    View Your Orders
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
} 