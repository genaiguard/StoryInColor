import { Camera, Book, Truck } from "lucide-react"

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-gray-50 py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">How It Works</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Transform your cherished memories into custom coloring books in just three simple steps
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
          <div className="flex flex-col items-center space-y-4 rounded-lg border bg-white p-8 shadow-sm">
            <div className="rounded-full bg-orange-100 p-6">
              <Camera className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-2xl font-bold text-center">1. Upload Photos</h3>
            <p className="text-center text-gray-500">
              Upload your vacation photos, family pictures, or any special memories you want to transform.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-4 rounded-lg border bg-white p-8 shadow-sm">
            <div className="rounded-full bg-purple-100 p-6">
              <Book className="h-8 w-8 text-purple-500" />
            </div>
            <h3 className="text-2xl font-bold text-center">2. Preview & Customize</h3>
            <p className="text-center text-gray-500">
              Our AI converts your photos into coloring pages. Preview your book and make any adjustments.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-4 rounded-lg border bg-white p-8 shadow-sm">
            <div className="rounded-full bg-pink-100 p-6">
              <Truck className="h-8 w-8 text-pink-500" />
            </div>
            <h3 className="text-2xl font-bold text-center">3. Receive Your Book</h3>
            <p className="text-center text-gray-500">
              We print and ship your custom coloring book directly to your doorstep, ready to enjoy.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

