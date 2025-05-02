export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="bg-gray-50 py-12 md:py-16 lg:py-20">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">What Our Customers Say</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Hear from people who have turned their memories into coloring books
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
          <div className="flex flex-col rounded-lg border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gray-100 p-1">
                <div className="h-10 w-10 rounded-full bg-gray-200"></div>
              </div>
              <div>
                <h4 className="font-semibold">Sarah T.</h4>
                <p className="text-sm text-gray-500">Family Vacation Book</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-700">
                "I created a coloring book from our trip to Hawaii and my kids absolutely love it! The quality is
                amazing and it's such a unique way to remember our vacation."
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
              <div className="rounded-full bg-gray-100 p-1">
                <div className="h-10 w-10 rounded-full bg-gray-200"></div>
              </div>
              <div>
                <h4 className="font-semibold">Michael R.</h4>
                <p className="text-sm text-gray-500">Anniversary Gift</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-700">
                "I surprised my wife with a coloring book of our wedding photos for our anniversary. She was so touched
                by the thoughtful gift. The quality exceeded my expectations!"
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
              <div className="rounded-full bg-gray-100 p-1">
                <div className="h-10 w-10 rounded-full bg-gray-200"></div>
              </div>
              <div>
                <h4 className="font-semibold">Jennifer L.</h4>
                <p className="text-sm text-gray-500">Pet Portrait Book</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-gray-700">
                "I created a coloring book of our golden retriever for my daughter's birthday. She absolutely loves
                coloring pictures of her best friend. The detail in the line drawings is amazing!"
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

