"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Package, ShoppingBag } from "lucide-react"
import { useFirebase } from "@/app/firebase/firebase-provider"

export default function OrderSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  
  const { user, initialized } = useFirebase()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simple wait to ensure the webhook has time to process
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [])

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
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
              <p className="text-gray-500">Processing your order...</p>
            </div>
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
                      Order Number: <span className="font-medium">{sessionId.substring(0, 8).toUpperCase()}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Estimated Delivery: <span className="font-medium">{new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                    </p>
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