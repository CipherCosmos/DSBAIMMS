'use client'
// @ts-nocheck

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { List as VirtualList } from 'react-window'
import { useRenderOptimization } from '@/lib/performance'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: keyof T
  title: string
  width?: number
  sortable?: boolean
  render?: (value: any, item: T, index: number) => React.ReactNode
  align?: 'left' | 'center' | 'right'
}

interface OptimizedTableProps<T> {
  data: T[]
  columns: Column<T>[]
  height?: number
  rowHeight?: number
  width?: number | string
  className?: string
  virtualized?: boolean
  sortable?: boolean
  filterable?: boolean
  selectable?: boolean
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void
  onFilter?: (filters: Record<string, any>) => void
  onSelect?: (selectedItems: T[]) => void
  loading?: boolean
  emptyMessage?: string
}

export function OptimizedTable<T>({
  data,
  columns,
  height = 400,
  rowHeight = 50,
  width = '100%',
  className,
  virtualized = true,
  sortable = true,
  filterable = false,
  selectable = false,
  onSort,
  onFilter,
  onSelect,
  loading = false,
  emptyMessage = 'No data available',
}: OptimizedTableProps<T>) {
  const { renderTime } = useRenderOptimization('OptimizedTable')
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [selectedItems, setSelectedItems] = useState<T[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const listRef = useRef<any>(null)

  // Memoized sorted and filtered data
  const processedData = useMemo(() => {
    let result = [...data]

    // Apply search filter
    if (searchTerm) {
      result = result.filter(item =>
        columns.some(column => {
          const value = item[column.key]
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        })
      )
    }

    // Apply column filters
    if (Object.keys(filters).length > 0) {
      result = result.filter(item =>
        Object.entries(filters).every(([key, value]) => {
          if (!value) return true
          const itemValue = item[key as keyof T]
          return itemValue && itemValue.toString().toLowerCase().includes(value.toLowerCase())
        })
      )
    }

    // Apply sorting
    if (sortKey) {
      result.sort((a, b) => {
        const aValue = a[sortKey]
        const bValue = b[sortKey]
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [data, columns, searchTerm, filters, sortKey, sortDirection])

  // Handle sort
  const handleSort = useCallback((key: keyof T) => {
    if (!sortable) return

    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortKey(key)
    setSortDirection(newDirection)
    onSort?.(key, newDirection)
  }, [sortable, sortKey, sortDirection, onSort])

  // Handle filter
  const handleFilter = useCallback((key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilter?.(newFilters)
  }, [filters, onFilter])

  // Handle select
  const handleSelect = useCallback((item: T, selected: boolean) => {
    if (!selectable) return

    const newSelectedItems = selected
      ? [...selectedItems, item]
      : selectedItems.filter(selectedItem => selectedItem !== item)
    
    setSelectedItems(newSelectedItems)
    onSelect?.(newSelectedItems)
  }, [selectable, selectedItems, onSelect])

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    if (!selectable) return

    const newSelectedItems = selected ? [...processedData] : []
    setSelectedItems(newSelectedItems)
    onSelect?.(newSelectedItems)
  }, [selectable, processedData, onSelect])

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({})
    setSearchTerm('')
    onFilter?.({})
  }, [onFilter])

  // Row renderer for virtualized table
  const RowRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = processedData[index]
    if (!item) return null

    const isSelected = selectedItems.includes(item)

    return (
      <div
        style={style}
        className={cn(
          'flex items-center border-b border-gray-200 hover:bg-gray-50 transition-colors',
          isSelected && 'bg-blue-50'
        )}
      >
        {/* Selection checkbox */}
        {selectable && (
          <div className="w-12 px-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleSelect(item, e.target.checked)}
              className="rounded border-gray-300"
            />
          </div>
        )}

        {/* Data columns */}
        {columns.map((column, colIndex) => {
          const value = item[column.key]
          const content = column.render ? column.render(value, item, index) : value

          return (
            <div
              key={String(column.key)}
              className={cn(
                'px-4 py-3 text-sm',
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right'
              )}
              style={{ width: column.width || 'auto', flex: column.width ? 'none' : 1 }}
            >
{String(content)}
            </div>
          )
        })}
      </div>
    )
  }, [processedData, columns, selectedItems, selectable, handleSelect])

  // Render header
  const renderHeader = () => (
    <div className="flex items-center bg-gray-50 border-b border-gray-200 font-medium text-sm text-gray-700">
      {/* Selection header */}
      {selectable && (
        <div className="w-12 px-4">
          <input
            type="checkbox"
            checked={selectedItems.length === processedData.length && processedData.length > 0}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="rounded border-gray-300"
          />
        </div>
      )}

      {/* Column headers */}
      {columns.map((column) => (
        <div
          key={String(column.key)}
          className={cn(
            'px-4 py-3',
            column.align === 'center' && 'text-center',
            column.align === 'right' && 'text-right',
            sortable && column.sortable !== false && 'cursor-pointer hover:bg-gray-100'
          )}
          style={{ width: column.width || 'auto', flex: column.width ? 'none' : 1 }}
          onClick={() => column.sortable !== false && handleSort(column.key)}
        >
          <div className="flex items-center space-x-1">
            <span>{column.title}</span>
            {sortable && column.sortable !== false && (
              <div className="flex flex-col">
                <div
                  className={cn(
                    'w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-400',
                    sortKey === column.key && sortDirection === 'asc' && 'border-b-blue-500'
                  )}
                />
                <div
                  className={cn(
                    'w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-400',
                    sortKey === column.key && sortDirection === 'desc' && 'border-t-blue-500'
                  )}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // Render filters
  const renderFilters = () => {
    if (!filterable) return null

    return (
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Column filters */}
          {columns.map((column) => (
            <input
              key={String(column.key)}
              type="text"
              placeholder={`Filter ${column.title}...`}
              value={filters[String(column.key)] || ''}
              onChange={(e) => handleFilter(String(column.key), e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ))}

          {/* Clear filters */}
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear
          </button>
        </div>
      </div>
    )
  }

  // Render virtualized table
  const renderVirtualizedTable = () => (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {renderHeader()}
      {renderFilters()}
      
      {processedData.length > 0 ? (
        <>
          {/* @ts-ignore */}
          <VirtualList
            ref={listRef}
            height={height - (filterable ? 120 : 60)}
            itemCount={processedData.length}
            itemSize={rowHeight}
            width={width}
            className="scrollbar-thin scrollbar-thumb-gray-300"
          >
            RowRenderer
          </VirtualList>
        </>
      ) : (
        <div className="flex items-center justify-center py-8 text-gray-500">
          {emptyMessage}
        </div>
      )}
    </div>
  )

  // Render regular table
  const renderRegularTable = () => (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {renderHeader()}
      {renderFilters()}
      
      <div className="overflow-y-auto" style={{ height: height - (filterable ? 120 : 60) }}>
        {processedData.length > 0 ? (
          <AnimatePresence>
            {processedData.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {/* Selection checkbox */}
                {selectable && (
                  <div className="w-12 px-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item)}
                      onChange={(e) => handleSelect(item, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </div>
                )}

                {/* Data columns */}
                {columns.map((column) => {
                  const value = item[column.key]
                  const content = column.render ? column.render(value, item, index) : value

                  return (
                    <div
                      key={String(column.key)}
                      className={cn(
                        'px-4 py-3 text-sm',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right'
                      )}
                      style={{ width: column.width || 'auto', flex: column.width ? 'none' : 1 }}
                    >
{String(content)}
                    </div>
                  )
                })}
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative">
      {/* Performance indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 z-10 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
          Render: {renderTime.toFixed(2)}ms
        </div>
      )}

      {/* Table info */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          {processedData.length} of {data.length} items
          {selectedItems.length > 0 && ` (${selectedItems.length} selected)`}
        </div>
        
        <div className="text-sm text-gray-500">
          {virtualized ? 'Virtualized' : 'Regular'} table
        </div>
      </div>

      {/* Table content */}
      {virtualized ? renderVirtualizedTable() : renderRegularTable()}

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
              <div className="text-sm text-gray-600">Loading...</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
