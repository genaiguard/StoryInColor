interface BlogPaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
}

export function BlogPagination({ currentPage, totalPages, basePath }: BlogPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex justify-center items-center gap-2 mt-8">
      {/* Previous button */}
      {currentPage > 1 && (
        <a
          href={currentPage === 2 ? basePath : `${basePath}?page=${currentPage - 1}`}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Previous
        </a>
      )}

      {/* Page numbers */}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <a
          key={page}
          href={page === 1 ? basePath : `${basePath}?page=${page}`}
          className={`px-3 py-2 border rounded ${
            page === currentPage
              ? 'bg-orange-500 text-white border-orange-500'
              : 'hover:bg-gray-100'
          }`}
        >
          {page}
        </a>
      ))}

      {/* Next button */}
      {currentPage < totalPages && (
        <a
          href={`${basePath}?page=${currentPage + 1}`}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Next
        </a>
      )}
    </div>
  )
}
