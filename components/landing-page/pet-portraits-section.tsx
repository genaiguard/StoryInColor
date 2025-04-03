import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PathImg } from "@/components/ui/pathed-image"

export default function PetPortraitsSection() {
  return (
    <section id="pet-portraits" className="bg-white py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
              Loved Ones In Vibrant <span className="text-orange-500">Detail</span>
            </h2>
            <p className="text-gray-700 md:text-lg mb-6">
              Our AI technology captures the essence of your furry friends and family members, creating detailed line art
              perfect for coloring. Every whisker, smile, and expression is preserved in our conversion process.
            </p>
            <div className="space-y-4 mb-8">
              <div className="flex items-start">
                <div className="bg-orange-100 p-1 rounded mr-3 mt-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-orange-500"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Remarkable Detail</h3>
                  <p className="text-gray-700">
                    Our conversion preserves important features while creating coloring-friendly illustrations
                  </p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-orange-100 p-1 rounded mr-3 mt-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-orange-500"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Perfect For All Ages</h3>
                  <p className="text-gray-700">
                    From toddlers to seniors, our coloring pages provide a rewarding creative experience
                  </p>
                </div>
              </div>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 text-base font-medium" asChild>
              <Link href="/login">Create Your Pet Portrait Book</Link>
            </Button>
          </div>
          <div className="mt-8 md:mt-0">
            <div className="relative rounded-lg overflow-hidden shadow-lg">
              <PathImg
                src="/images/dog-coloring-hero.png"
                alt="A side-by-side comparison showing an original color photo of a golden retriever and its converted line art version suitable for coloring"
                width={600}
                height={500}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

