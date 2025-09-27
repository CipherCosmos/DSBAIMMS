'use client'
// @ts-nocheck

import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { List as VirtualList } from 'react-window'
import { motion, AnimatePresence } from 'framer-motion'
import { useVirtualizedList } from './VirtualizedList'

export interface Column<T> {
  key: keyof T | string
  title: string
  width?: number
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, item: T, index: number) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}

export interface PerformanceOptimizedTableProps<T> {
  data: T[]
  columns: Column<T>[]
  height?: number
  rowHeight?: number
  className?: string
  loading?: boolean
  error?: Error | null
  onRowClick?: (item: T, index: number) => void
  onSort?: (column: string, direction: 'asc' | 'desc') => void
  onFilter?: (column: string, value: string) => void
  searchTerm?: string
  onSearch?: (term: string) => void
  selectedRows?: Set<number>
  onSelectionChange?: (selectedRows: Set<number>) => void
  selectable?: boolean
  emptyState?: React.ReactNode
  loadingState?: React.ReactNode
  errorState?: React.ReactNode
}

// Default empty state
const DefaultEmptyState = () => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="text-gray-400 mb-4">
      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No data available</h3>
    <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
  </div>
)

// Default loading state
const DefaultLoadingState = () => (
  <div className="space-y-3 p-4">
    {Array.from({ length: 5 }).map((_, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.1 }}
        className="animate-pulse bg-gray-200 rounded-lg h-12"
      />
    ))}
  </div>
)

// Default error state
const DefaultErrorState = ({ error, retry }: { error: Error; retry?: () => void }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="text-red-600 mb-4">
      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading data</h3>
    <p className="text-sm text-gray-500 mb-4">
      {process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while loading the data'}
    </p>
    {retry && (
      <button
        onClick={retry}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Try again
      </button>
    )}
  </div>
)

export function PerformanceOptimizedTable<T extends Record<string, any>>({
  data,
  columns,
  height = 400,
  rowHeight = 50,
  className = '',
  loading = false,
  error = null,
  onRowClick,
  onSort,
  onFilter,
  searchTerm = '',
  onSearch,
  selectedRows = new Set(),
  onSelectionChange,
  selectable = false,
  emptyState = <DefaultEmptyState />,
  loadingState = <DefaultLoadingState />,
  errorState,
}: PerformanceOptimizedTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [isAllSelected, setIsAllSelected] = useState(false)

  // Calculate column widths
  const columnWidths = useMemo(() => {
    const totalWidth = columns.reduce((sum, col) => sum + (col.width || 150), 0)
    return columns.map(col => ({
      ...col,
      width: col.width || Math.max(150, (col.width || 150) * (800 / totalWidth)),
    }))
  }, [columns])

  // Sort and filter data
  const processedData = useMemo(() => {
    let result = [...data]

    // Apply search filter
    if (searchTerm) {
      result = result.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    // Apply column filters
    Object.entries(filters).forEach(([column, value]) => {
      if (value) {
        result = result.filter(item =>
          String(item[column]).toLowerCase().includes(value.toLowerCase())
        )
      }
    })

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, searchTerm, filters, sortColumn, sortDirection])

  // Handle column sorting
  const handleSort = useCallback((column: string) => {
    if (!onSort) return

    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(newDirection)
    onSort(column, newDirection)
  }, [sortColumn, sortDirection, onSort])

  // Handle row selection
  const handleRowSelect = useCallback((index: number) => {
    if (!onSelectionChange) return

    const newSelected = new Set(selectedRows)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    onSelectionChange(newSelected)
  }, [selectedRows, onSelectionChange])

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return

    if (isAllSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(processedData.map((_, index) => index)))
    }
    setIsAllSelected(!isAllSelected)
  }, [isAllSelected, processedData, onSelectionChange])

  // Row renderer for virtualized list
  const RowRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = processedData[index]
    if (!item) return null

    const isSelected = selectedRows.has(index)

    return (
      <motion.div
        style={style}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.02 }}
        className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50' : ''
        } ${onRowClick ? 'cursor-pointer' : ''}`}
        onClick={() => onRowClick?.(item, index)}
      >
        {selectable && (
          <div className="px-4 py-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleRowSelect(index)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        )}
        {columnWidths.map((column, colIndex) => (
          <div
            key={String(column.key)}
            className="px-4 py-2 flex-1"
            style={{ width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth }}
          >
            {column.render ? (
              column.render(item[column.key], item, index)
            ) : (
              <span className={`text-sm ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}>
                {String(item[column.key] || '')}
              </span>
            )}
          </div>
        ))}
      </motion.div>
    )
  }, [processedData, selectedRows, columnWidths, onRowClick, selectable, handleRowSelect])

  // Show loading state
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        {loadingState}
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        {errorState || <DefaultErrorState error={error} />}
      </div>
    )
  }

  // Show empty state
  if (processedData.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        {emptyState}
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Table Header */}
      <div className="flex items-center border-b border-gray-200 bg-gray-50">
        {selectable && (
          <div className="px-4 py-3">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        )}
        {columnWidths.map((column) => (
          <div
            key={String(column.key)}
            className="px-4 py-3 flex-1 font-medium text-gray-900"
            style={{ width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth }}
          >
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}>
                {column.title}
              </span>
              {column.sortable && (
                <button
                  onClick={() => handleSort(String(column.key))}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Virtualized Table Body */}
      {/* @ts-ignore */}
      <VirtualList
        height={height}
        itemCount={processedData.length}
        itemSize={rowHeight}
        overscanCount={5}
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
RowRenderer
      </VirtualList>
    </div>
  )
}
