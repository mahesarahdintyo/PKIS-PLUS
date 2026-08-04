'use client'

interface Category {
  id: number
  name: string
}

interface CategoryFilterProps {
  categories: Category[]
  selectedCategory: string
  onCategoryChange: (categoryId: string) => void
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  // Transform category name to filter value
  const getCategoryFilterValue = (name: string) => name.toLowerCase()

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onCategoryChange('all')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          selectedCategory === 'all'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        Semua
      </button>
      {categories.map((category) => {
        const filterValue = getCategoryFilterValue(category.name)
        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange(filterValue)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === filterValue
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {category.name}
          </button>
        )
      })}
    </div>
  )
}
