import { ImageIcon, Heart, Package, Camera } from "lucide-react"
import { PathImg } from "@/components/ui/pathed-image"

export default function ExamplesSection() {
  return (
    <section id="examples" className="py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Perfect For Your Memories</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Create personalized coloring books from your favorite moments
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 py-8">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-blue-100 p-3">
              <ImageIcon className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-sm font-medium">Vacation Photos</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-pink-100 p-3">
              <Heart className="h-5 w-5 text-pink-500" />
            </div>
            <span className="text-sm font-medium">Wedding Memories</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-green-100 p-3">
              <Package className="h-5 w-5 text-green-500" />
            </div>
            <span className="text-sm font-medium">Family Trips</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-orange-100 p-3">
              <Camera className="h-5 w-5 text-orange-500" />
            </div>
            <span className="text-sm font-medium">Special Events</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-purple-100 p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-purple-500"
              >
                <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" />
                <path d="M14.5 5.17c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.344-2.5" />
                <path d="M8 14v.5" />
                <path d="M16 14v.5" />
                <path d="M11.25 16.25h1.5L12 17l-.75-.75Z" />
                <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" />
              </svg>
            </div>
            <span className="text-sm font-medium">Beloved Pets</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
          <div className="flex flex-col space-y-3">
            <div className="relative overflow-hidden rounded-lg shadow-md">
              <PathImg
                src="/images/bali-coloring-book.webp"
                alt="Bali vacation coloring book showing a couple standing next to a Ganesha statue, with the original photo on a smartphone"
                width={400}
                height={400}
                className="w-full h-auto"
              />
            </div>
            <h3 className="text-lg font-bold">Honeymoon Memories</h3>
            <p className="text-sm text-gray-500">
              Transform your romantic getaway photos into beautiful coloring pages
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <div className="relative overflow-hidden rounded-lg shadow-md">
              <PathImg
                src="/images/family-trip-coloring.webp"
                alt="Family trip coloring book cover showing parents and children on vacation"
                width={400}
                height={400}
                className="w-full h-auto"
              />
            </div>
            <h3 className="text-lg font-bold">Family Vacation</h3>
            <p className="text-sm text-gray-500">Create personalized coloring books from your favorite family trips</p>
          </div>

          <div className="flex flex-col space-y-3">
            <div className="relative overflow-hidden rounded-lg shadow-md">
              <PathImg
                src="/images/hero-graduation.webp"
                alt="Woman holding graduation coloring book showing how photos become coloring pages"
                width={400}
                height={400}
                className="w-full h-auto"
              />
            </div>
            <h3 className="text-lg font-bold">Graduation</h3>
            <p className="text-sm text-gray-500">
              Commemorate academic achievements with custom graduation coloring books
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <div className="relative overflow-hidden rounded-lg shadow-md">
              <PathImg
                src="/images/countryside-coloring.webp"
                alt="Coloring book page showing two people in sun hats walking toward a vine-covered cottage"
                width={400}
                height={400}
                className="w-full h-auto"
              />
            </div>
            <h3 className="text-lg font-bold">European Getaways</h3>
            <p className="text-sm text-gray-500">Turn your European vacation memories into charming coloring pages</p>
          </div>

          <div className="flex flex-col space-y-3">
            <div className="relative overflow-hidden rounded-lg shadow-md">
              <PathImg
                src="/images/city-skyline-couple.webp"
                alt="Coloring book page showing a couple taking a selfie with a city skyline and Ferris wheel in the background"
                width={400}
                height={400}
                className="w-full h-auto"
              />
            </div>
            <h3 className="text-lg font-bold">City Adventures</h3>
            <p className="text-sm text-gray-500">
              Transform your urban explorations and city trips into detailed coloring pages
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <div className="relative overflow-hidden rounded-lg shadow-md">
              <PathImg
                src="/images/coloring-bali-temple.webp"
                alt="Person coloring a page of a woman at a Balinese temple, with the original photo shown on a smartphone"
                width={400}
                height={400}
                className="w-full h-auto"
              />
            </div>
            <h3 className="text-lg font-bold">Your Memories Next</h3>
            <p className="text-sm text-gray-500">
              Upload your photos and create your own custom coloring book to enjoy
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

