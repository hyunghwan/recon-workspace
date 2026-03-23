import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

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
        <Route element={<WorkspaceLayout />}>
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

function WorkspaceEntryRedirect() {
  const { buildDefaultPath, routingReady } = useWorkspace()
  const targetPath = buildDefaultPath('queue')

  if (!routingReady) {
    return <WorkspaceLoadingState />
  }

  if (!targetPath) {
    return <WorkspaceBlankState />
  }

  return <Navigate replace to={targetPath} />
}

function WorkspaceSectionRedirect() {
  const { buildCurrentPath, routingReady } = useWorkspace()
  const nextPath = buildCurrentPath('queue')

  if (!routingReady) {
    return <WorkspaceLoadingState />
  }

  if (!nextPath) {
    return <WorkspaceBlankState />
  }

  return <Navigate replace to={nextPath} />
}

function WorkspaceReadyGuard() {
  const { routingReady, snapshot } = useWorkspace()

  if (!routingReady) {
    return <WorkspaceLoadingState />
  }

  if (!snapshot.workspaces.length) {
    return <WorkspaceBlankState />
  }

  return <Outlet />
}

function WorkspaceLoadingState() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Card className="w-full max-w-md border border-white/70 bg-white/90 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
        <CardHeader>
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

function WorkspaceBlankState() {
  const { setShowNewWorkspaceForm } = useWorkspace()

  return (
    <WorkspaceChecklistState
      eyebrow="Your workspace is empty"
      title="Start with one client and one close month."
      description="Create the first client workspace, add the month you are closing, and then bring in the files you want to review."
      primaryAction={{
        label: 'Create client workspace',
        onClick: () => setShowNewWorkspaceForm(true),
      }}
      steps={[
        {
          title: 'Create a client workspace',
          body: 'Give each client its own review space so the month-end work stays separated.',
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
