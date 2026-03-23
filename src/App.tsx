import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/auth/AuthProvider'
import { ReconLockup } from '@/components/brand/ReconBrand'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const MarketingRoute = lazy(() => import('@/features/marketing/MarketingRoute'))
const WorkspaceRoute = lazy(() => import('@/features/workspace/WorkspaceRoute'))

function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f1] px-4">
      <Card className="w-full max-w-md border border-white/70 bg-white/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
        <CardHeader className="space-y-4">
          <ReconLockup
            subtitle="A tighter mark for month-end review."
            markClassName="h-12 w-12"
            titleClassName="text-base font-semibold text-[#102d28]"
            subtitleClassName="text-sm text-[#617a73]"
          />
          <CardTitle>Loading Recon Workspace</CardTitle>
          <CardDescription>
            Preparing the right experience for either the marketing site or the workspace app.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Route-level loading keeps the marketing landing and the app workspace from sharing one oversized shell.
        </CardContent>
      </Card>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingShell />}>
        <Routes>
          <Route path="/" element={<MarketingRoute />} />
          <Route path="/app/*" element={<WorkspaceRoute />} />
          <Route path="*" element={<MarketingRoute />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
