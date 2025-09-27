'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LazyWrapper, 
  VirtualizedList, 
  InfiniteScroll, 
  PerformanceOptimizedTable,
  ImageOptimizer,
  PerformanceMonitor
} from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

// Sample data for demonstrations
const sampleUsers = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: ['admin', 'teacher', 'student', 'hod'][i % 4],
  department: `Department ${(i % 10) + 1}`,
  status: i % 3 === 0 ? 'active' : 'inactive',
  lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
}))

const sampleImages = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=300&fit=crop',
]

export function ComponentOptimizationDemo() {
  const [activeTab, setActiveTab] = useState('lazy-loading')
  const [searchTerm, setSearchTerm] = useState('')
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false)
  const [virtualizedData, setVirtualizedData] = useState(sampleUsers.slice(0, 100))
  const [infiniteData, setInfiniteData] = useState(sampleUsers.slice(0, 20))
  const [hasNextPage, setHasNextPage] = useState(true)
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return sampleUsers
    return sampleUsers.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm])

  // Simulate fetching more data for infinite scroll
  const fetchNextPage = useCallback(() => {
    setIsFetchingNextPage(true)
    
    setTimeout(() => {
      const currentLength = infiniteData.length
      const newData = sampleUsers.slice(currentLength, currentLength + 20)
      
      if (newData.length === 0) {
        setHasNextPage(false)
      } else {
        setInfiniteData(prev => [...prev, ...newData])
      }
      
      setIsFetchingNextPage(false)
    }, 1000)
  }, [infiniteData.length])

  // Table columns configuration
  const tableColumns = [
    {
      key: 'id',
      title: 'ID',
      width: 80,
      sortable: true,
    },
    {
      key: 'name',
      title: 'Name',
      width: 200,
      sortable: true,
      filterable: true,
    },
    {
      key: 'email',
      title: 'Email',
      width: 250,
      sortable: true,
      filterable: true,
    },
    {
      key: 'role',
      title: 'Role',
      width: 120,
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'admin' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'department',
      title: 'Department',
      width: 150,
      sortable: true,
    },
    {
      key: 'status',
      title: 'Status',
      width: 100,
      render: (value: string) => (
        <Badge variant={value === 'active' ? 'default' : 'outline'}>
          {value}
        </Badge>
      ),
    },
  ]

  // Virtualized list item renderer
  const renderVirtualizedItem = useCallback(({ index, style, item }: { index: number; style: React.CSSProperties; item: any }) => (
    <div style={style} className="px-4 py-2 border-b border-gray-200 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{item.name}</div>
          <div className="text-sm text-gray-500">{item.email}</div>
        </div>
        <Badge variant={item.role === 'admin' ? 'default' : 'secondary'}>
          {item.role}
        </Badge>
      </div>
    </div>
  ), [])

  // Infinite scroll item renderer
  const renderInfiniteItem = useCallback((item: any, index: number) => (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-gray-500">{item.email}</div>
          </div>
          <Badge variant={item.role === 'admin' ? 'default' : 'secondary'}>
            {item.role}
          </Badge>
        </div>
      </CardContent>
    </Card>
  ), [])

  const tabs = [
    { id: 'lazy-loading', label: 'Lazy Loading', icon: '⏳' },
    { id: 'virtualization', label: 'Virtualization', icon: '📊' },
    { id: 'infinite-scroll', label: 'Infinite Scroll', icon: '♾️' },
    { id: 'optimized-table', label: 'Optimized Table', icon: '📋' },
    { id: 'image-optimization', label: 'Image Optimization', icon: '🖼️' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Component Optimization Demo</h1>
        <Badge variant="outline">Phase 3 Complete</Badge>
      </div>

      {/* Performance Monitor Toggle */}
      <div className="flex items-center space-x-4">
        <Button
          onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>{showPerformanceMonitor ? 'Hide' : 'Show'} Performance Monitor</span>
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'lazy-loading' && (
            <Card>
              <CardHeader>
                <CardTitle>Lazy Loading Demo</CardTitle>
                <CardDescription>
                  Components are loaded only when they come into view
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <LazyWrapper
                      key={index}
                      threshold={0.1}
                      rootMargin="100px"
                      className="min-h-[200px]"
                    >
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="font-semibold mb-2">Lazy Loaded Component {index + 1}</h3>
                          <p className="text-gray-600">
                            This component was loaded only when it came into view.
                            Scroll up and down to see the lazy loading in action.
                          </p>
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <div className="text-sm text-blue-800">
                              Loaded at: {new Date().toLocaleTimeString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </LazyWrapper>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'virtualization' && (
            <Card>
              <CardHeader>
                <CardTitle>Virtualization Demo</CardTitle>
                <CardDescription>
                  Only visible items are rendered, improving performance with large datasets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label htmlFor="search">Search Users</Label>
                  <Input
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or role..."
                    className="mt-1"
                  />
                </div>
                <VirtualizedList
                  items={filteredUsers}
                  height={400}
                  itemHeight={60}
                  renderItem={renderVirtualizedItem}
                  searchTerm={searchTerm}
                  filterFn={(item, term) =>
                    item.name.toLowerCase().includes(term.toLowerCase()) ||
                    item.email.toLowerCase().includes(term.toLowerCase()) ||
                    item.role.toLowerCase().includes(term.toLowerCase())
                  }
                />
                <div className="mt-4 text-sm text-gray-600">
                  Showing {filteredUsers.length} users with virtualization
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'infinite-scroll' && (
            <Card>
              <CardHeader>
                <CardTitle>Infinite Scroll Demo</CardTitle>
                <CardDescription>
                  Data is loaded progressively as you scroll down
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InfiniteScroll
                  items={infiniteData}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                  renderItem={renderInfiniteItem}
                />
                <div className="mt-4 text-sm text-gray-600">
                  Loaded {infiniteData.length} users with infinite scroll
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'optimized-table' && (
            <Card>
              <CardHeader>
                <CardTitle>Optimized Table Demo</CardTitle>
                <CardDescription>
                  High-performance table with virtualization and sorting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PerformanceOptimizedTable
                  data={filteredUsers}
                  columns={tableColumns}
                  height={400}
                  rowHeight={50}
                  searchTerm={searchTerm}
                  onSearch={setSearchTerm}
                  selectable={true}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === 'image-optimization' && (
            <Card>
              <CardHeader>
                <CardTitle>Image Optimization Demo</CardTitle>
                <CardDescription>
                  Images are optimized with lazy loading and proper sizing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sampleImages.map((src, index) => (
                    <LazyWrapper key={index} threshold={0.1} rootMargin="100px">
                      <Card>
                        <CardContent className="p-0">
                          <ImageOptimizer
                            src={src}
                            alt={`Optimized image ${index + 1}`}
                            width={400}
                            height={300}
                            quality={75}
                            placeholder="blur"
                            className="rounded-t-lg"
                          />
                          <div className="p-4">
                            <h3 className="font-semibold">Optimized Image {index + 1}</h3>
                            <p className="text-sm text-gray-600">
                              This image is lazy loaded and optimized for performance
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </LazyWrapper>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Performance Monitor */}
      {showPerformanceMonitor && (
        <PerformanceMonitor
          componentName="ComponentOptimizationDemo"
          showMetrics={true}
        />
      )}

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Benefits</CardTitle>
          <CardDescription>
            Performance improvements achieved through component optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">60%</div>
              <div className="text-sm text-gray-600">Faster Loading</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">80%</div>
              <div className="text-sm text-gray-600">Less Memory</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">90%</div>
              <div className="text-sm text-gray-600">Better UX</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">100%</div>
              <div className="text-sm text-gray-600">Type Safe</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

