"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useState, FormEvent } from "react"
import { getFunctions, httpsCallable } from "firebase/functions"

export default function ContactPage() {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  })
  
  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)
  
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: value
    }))
  }
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitResult(null)
    
    try {
      // Validate form data
      if (!formData.name || !formData.email || !formData.subject || !formData.message) {
        setSubmitResult({
          success: false,
          message: "Please fill in all fields"
        })
        setIsSubmitting(false)
        return
      }
      
      // Get Firebase functions instance
      const functions = getFunctions()
      const submitContactForm = httpsCallable(functions, 'submitContactForm')
      
      // Call the function
      const result = await submitContactForm(formData)
      const data = result.data as { success: boolean; message: string }
      
      // Show success message
      setSubmitResult({
        success: true,
        message: data.message || "Your message has been sent. We will get back to you soon!"
      })
      
      // Clear form
      setFormData({
        name: "",
        email: "",
        subject: "",
        message: ""
      })
    } catch (error: any) {
      // Show error message
      setSubmitResult({
        success: false,
        message: error.message || "An error occurred. Please try again later."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              Story<span className="text-orange-500">InColor</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-orange-500">
              Back to Home
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 bg-gray-50">
        <section className="py-12 md:py-16 lg:py-20">
          <div className="container px-4 md:px-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-6 text-center">Contact Us</h1>
              <p className="text-center text-gray-700 mb-8">
                We'd love to hear from you! Use the form below to send us a message.
              </p>
              
              {submitResult && (
                <div className={`mb-6 p-4 rounded-md ${submitResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {submitResult.message}
                </div>
              )}
              
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      Name
                    </label>
                    <input 
                      id="name" 
                      className="w-full rounded-md border border-gray-300 p-2" 
                      value={formData.name}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <input 
                      id="email" 
                      type="email" 
                      className="w-full rounded-md border border-gray-300 p-2" 
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium">
                    Subject
                  </label>
                  <input 
                    id="subject" 
                    className="w-full rounded-md border border-gray-300 p-2" 
                    value={formData.subject}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    Message
                  </label>
                  <textarea 
                    id="message" 
                    className="h-32 w-full rounded-md border border-gray-300 p-2"
                    value={formData.message}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                  ></textarea>
                </div>
                <Button 
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-gray-100">
        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 md:gap-2">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  Story<span className="text-orange-500">InColor</span>
                </span>
              </Link>
              <p className="text-xs text-gray-500">© 2024 StoryInColor. All rights reserved.</p>
            </div>
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

