import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { ReconLockup } from '@/components/brand/ReconBrand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import FollowUpPage from './FollowUpPage'
import ImportsPage from './ImportsPage'
import QueuePage from './QueuePage'
import { WorkspaceChecklistState } from './workspace-empty-states'
import WorkspaceLayout from './WorkspaceLayout'
import { useWorkspace } from './workspace-context'
import { WorkspaceProvider } from './WorkspaceProvider'

export default function WorkspaceRoute() {
  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<WorkspaceShellGuard />}>
          <Route index element={<WorkspaceEntryRedirect />} />
          <Route element={<WorkspaceReadyGuard />}>
            <Route path=":workspaceId/:periodId" element={<WorkspaceSectionRedirect />} />
            <Route path=":workspaceId/:periodId/queue" element={<QueuePage />} />
            <Route path=":workspaceId/:periodId/imports" element={<ImportsPage />} />
            <Route path=":workspaceId/:periodId/follow-up" element={<FollowUpPage />} />
          </Route>
          <Route path="*" element={<WorkspaceEntryRedirect />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  )
}

function WorkspaceShellGuard() {
  const { authReady, cloudEnabled, handleDirectSignIn, routingReady, userSignedIn } = useWorkspace()

  if (!authReady || !routingReady) {
    return <WorkspaceLoadingState />
  }

  if (!userSignedIn) {
    return <WorkspaceSignInState cloudEnabled={cloudEnabled} onSignIn={handleDirectSignIn} />
  }

  return <WorkspaceLayout />
}

function WorkspaceEntryRedirect() {
  const { buildDefaultPath } = useWorkspace()
  const targetPath = buildDefaultPath('queue')

  if (!targetPath) {
    return <WorkspaceBlankState />
  }

  return <Navigate replace to={targetPath} />
}

function WorkspaceSectionRedirect() {
  const { buildCurrentPath } = useWorkspace()
  const nextPath = buildCurrentPath('queue')

  if (!nextPath) {
    return <WorkspaceBlankState />
  }

  return <Navigate replace to={nextPath} />
}

function WorkspaceReadyGuard() {
  const { snapshot } = useWorkspace()

  if (!snapshot.workspaces.length) {
    return <WorkspaceBlankState />
  }

  return <Outlet />
}

function WorkspaceLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f1] px-4">
      <Card className="w-full max-w-md border border-white/70 bg-white/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
        <CardHeader className="space-y-4">
          <ReconLockup
            subtitle="Loading the right client and month before review opens."
            markClassName="h-12 w-12"
            titleClassName="text-base font-semibold text-[#102d28]"
            subtitleClassName="text-sm text-[#617a73]"
          />
          <CardTitle>Opening your month</CardTitle>
          <CardDescription>
            Loading the right client and month before opening the review list.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          If you have a cloud session, your saved data will load first.
        </CardContent>
      </Card>
    </div>
  )
}

function WorkspaceSignInState({
  cloudEnabled,
  onSignIn,
}: {
  cloudEnabled: boolean
  onSignIn: () => Promise<void>
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f1] px-4">
      <Card className="w-full max-w-xl border border-white/70 bg-white/95 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
        <CardHeader className="space-y-4">
          <ReconLockup
            subtitle="Sign in, review the sample month, then swap in your own data."
            markClassName="h-12 w-12"
            titleClassName="text-base font-semibold text-[#102d28]"
            subtitleClassName="text-sm text-[#617a73]"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[#102d28]">Sign in to open your clients</h1>
            <CardDescription className="text-sm leading-6">
              New accounts start with a sample client and month inside the app so you can see the flow immediately. You can delete the sample data as soon as you are ready to upload your own files.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            className="rounded-xl bg-[#173f39] text-white hover:bg-[#0f312b]"
            onClick={() => void onSignIn()}
            disabled={!cloudEnabled}
          >
            {cloudEnabled ? 'Sign in with Google' : 'Cloud unavailable'}
          </Button>
          <Button asChild variant="outline" className="rounded-xl border-[#dce4e1] bg-white">
            <a href="/">Back to home</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function WorkspaceBlankState() {
  const { setShowNewWorkspaceForm } = useWorkspace()

  return (
    <WorkspaceChecklistState
      eyebrow="Your client list is empty"
      title="Start with one client and one close month."
      description="Create the first client, add the month you are closing, and then bring in the files you want to review."
      primaryAction={{
        label: 'Create client',
        onClick: () => setShowNewWorkspaceForm(true),
      }}
      steps={[
        {
          title: 'Create a client',
          body: 'Give each client its own file list and review trail so the month-end work stays separated.',
        },
        {
          title: 'Add the month you are closing',
          body: 'Create the first close month before you bring in any statement or support files.',
        },
        {
          title: 'Import files and start review',
          body: 'Once files are in, the review list and follow-up page will fill in automatically.',
        },
      ]}
    />
  )
}
