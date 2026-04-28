import { User, UserCircle, UserRound } from "lucide-react"

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="bg-gray-50 py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">What our customers say</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Hear from people who have turned their photos into something incredible.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
          <div className="flex flex-col rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-orange-100 p-2">
                <User className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold">Sarah T.</h3>
                <p className="text-sm text-gray-500">Family Vacation</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-700">
                "Turned our Hawaii trip photos into a beautiful creation for the kids. They had a blast!
                Such a fun way to relive the memories. The result came out great."
              </p>
            </div>
            <div className="mt-4 flex">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-orange-500"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-purple-100 p-2">
                <UserCircle className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">Michael R.</h3>
                <p className="text-sm text-gray-500">Anniversary Gift</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-700">
                "Made a custom creation from our wedding pics for our anniversary. My wife was so surprised
                and loved the unique gift! The detail captured was seriously impressive."
              </p>
            </div>
            <div className="mt-4 flex">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-orange-500"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
          </div>

          <div className="flex flex-col rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-pink-100 p-2">
                <UserRound className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <h3 className="font-semibold">Jennifer L.</h3>
                <p className="text-sm text-gray-500">Pet Portrait</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-700">
                "Got a creation made from photos of our golden retriever for my daughter's birthday.
                She went crazy for it, loves having a picture of her furry buddy! The artwork really captured him perfectly."
              </p>
            </div>
            <div className="mt-4 flex">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 text-orange-500"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

