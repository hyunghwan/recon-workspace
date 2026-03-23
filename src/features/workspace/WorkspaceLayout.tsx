import { useState } from 'react'
import {
  ArrowRight,
  Cloud,
  Download,
  FolderPlus,
  LogIn,
  LogOut,
  PencilLine,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatMonthLabel, monthInputValue } from '@/utils'
import { useWorkspace } from './workspace-context'

const navItems = [
  { label: 'Files', page: 'imports' as const, description: 'Bring in this month’s files' },
  { label: 'Review', page: 'queue' as const, description: 'Transactions that still need attention' },
  { label: 'Follow-up', page: 'follow-up' as const, description: 'Share the open items list' },
]

export default function WorkspaceLayout() {
  const {
    authReady,
    buildCurrentPath,
    cloudEnabled,
    cloudMessage,
    currentPage,
    currentPeriodBundle,
    currentWorkspace,
    handleCreatePeriod,
    handleCreateWorkspace,
    handleDeletePeriod,
    handleDeleteWorkspace,
    handleDirectSignIn,
    handleExportFollowUp,
    handleLoadSampleSnapshot,
    handleManualSave,
    handleRenameWorkspace,
    handleSignOut,
    loadingCloud,
    navigateToPeriod,
    navigateToWorkspace,
    setShowNewPeriodForm,
    setShowNewWorkspaceForm,
    showNewPeriodForm,
    showNewWorkspaceForm,
    snapshot,
    stats,
    syncing,
    userEmail,
    userSignedIn,
  } = useWorkspace()
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newPeriodMonth, setNewPeriodMonth] = useState(monthInputValue())
  const [workspaceRenameDraft, setWorkspaceRenameDraft] = useState<{ workspaceId: string; value: string }>({
    workspaceId: '',
    value: '',
  })
  const workspaceRenameValue =
    workspaceRenameDraft.workspaceId === (currentWorkspace?.workspace.id ?? '')
      ? workspaceRenameDraft.value
      : currentWorkspace?.workspace.name ?? ''

  const importsCount = currentPeriodBundle?.imports.length ?? 0
  const recordsCount = currentPeriodBundle?.period.recordCounts.total ?? 0
  const importPath = currentPage !== 'imports' ? buildCurrentPath('imports') : null
  const pageTitle =
    currentPage === 'imports'
      ? 'Bring in this month’s files'
      : currentPage === 'follow-up'
        ? 'What still needs follow-up'
        : 'Transactions that still need attention'

  return (
    <div className="min-h-screen bg-[#eff3f2] text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="border-b border-[#dbe3e0] bg-[#f7f9f8] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-5 px-4 py-4 sm:px-6 lg:px-5 lg:py-5">
            <div className="space-y-4">
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[#153b35] text-sm font-semibold tracking-tight text-white">
                  R
                </div>
                <div>
                  <p className="text-sm font-medium tracking-tight text-foreground">Recon Workspace</p>
                  <p className="text-xs text-muted-foreground">A cleaner month-end review workspace</p>
                </div>
              </Link>

              <section className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Client</p>
                      <p className="mt-1 text-sm font-medium tracking-tight text-foreground">
                        {currentWorkspace?.workspace.name ?? 'No workspace selected'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-muted-foreground"
                      onClick={() => setShowNewWorkspaceForm(!showNewWorkspaceForm)}
                    >
                      <FolderPlus />
                      New
                    </Button>
                  </div>
                  <Select value={currentWorkspace?.workspace.id ?? ''} onValueChange={navigateToWorkspace}>
                    <SelectTrigger className="w-full rounded-lg border-[#dce4e1] bg-white shadow-none">
                      <SelectValue placeholder="Select client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshot.workspaces.map((workspaceBundle) => (
                        <SelectItem key={workspaceBundle.workspace.id} value={workspaceBundle.workspace.id}>
                          {workspaceBundle.workspace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showNewWorkspaceForm && (
                    <div className="flex gap-2">
                      <Input
                        aria-label="New client workspace name"
                        autoComplete="off"
                        name="workspace-name"
                        value={newWorkspaceName}
                        onChange={(event) => setNewWorkspaceName(event.target.value)}
                        placeholder="New client workspace..."
                        className="rounded-lg border-[#dce4e1] bg-white shadow-none"
                      />
                      <Button
                        variant="outline"
                        className="rounded-lg border-[#dce4e1] bg-white"
                        onClick={() => {
                          handleCreateWorkspace(newWorkspaceName)
                          setNewWorkspaceName('')
                          setShowNewWorkspaceForm(false)
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                  {currentWorkspace && (
                    <div className="space-y-2 border border-[#e2e8e5] bg-[#fafcfb] p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <PencilLine className="size-3.5" />
                        Workspace controls
                      </div>
                      <div className="flex gap-2">
                        <Input
                          aria-label="Rename workspace"
                          autoComplete="off"
                          name="workspace-rename"
                          value={workspaceRenameValue}
                          onChange={(event) =>
                            setWorkspaceRenameDraft({
                              workspaceId: currentWorkspace.workspace.id,
                              value: event.target.value,
                            })
                          }
                          placeholder="Workspace name..."
                          className="rounded-lg border-[#dce4e1] bg-white shadow-none"
                        />
                        <Button
                          variant="outline"
                          className="rounded-lg border-[#dce4e1] bg-white"
                          onClick={() => {
                            void handleRenameWorkspace(workspaceRenameValue)
                            setWorkspaceRenameDraft({
                              workspaceId: currentWorkspace.workspace.id,
                              value: workspaceRenameValue,
                            })
                          }}
                        >
                          Save
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full rounded-lg border-[#ead7d7] bg-white text-[#8a3d3d] hover:bg-[#fff4f4]"
                        onClick={() => {
                          const confirmed = window.confirm(`Delete workspace ${currentWorkspace.workspace.name}? This removes every month, file, and review state under it.`)
                          if (!confirmed) return
                          void handleDeleteWorkspace()
                        }}
                      >
                        <Trash2 />
                        Delete workspace
                      </Button>
                    </div>
                  )}
                </div>

                <div className="h-px bg-[#e2e8e5]" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Month</p>
                      <p className="mt-1 text-sm font-medium tracking-tight text-foreground">
                        {currentPeriodBundle ? formatMonthLabel(currentPeriodBundle.period.monthKey) : 'No month selected'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-muted-foreground"
                      onClick={() => setShowNewPeriodForm(!showNewPeriodForm)}
                    >
                      <ArrowRight />
                      New
                    </Button>
                  </div>
                  <Select value={currentPeriodBundle?.period.id ?? ''} onValueChange={navigateToPeriod}>
                    <SelectTrigger className="w-full rounded-lg border-[#dce4e1] bg-white shadow-none">
                      <SelectValue placeholder="Select month..." />
                    </SelectTrigger>
                    <SelectContent>
                      {currentWorkspace?.periods.map((periodBundle) => (
                        <SelectItem key={periodBundle.period.id} value={periodBundle.period.id}>
                          {formatMonthLabel(periodBundle.period.monthKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showNewPeriodForm && (
                    <div className="flex gap-2">
                      <Input
                        aria-label="New month"
                        autoComplete="off"
                        name="period-month"
                        type="month"
                        value={newPeriodMonth}
                        onChange={(event) => setNewPeriodMonth(event.target.value)}
                        className="rounded-lg border-[#dce4e1] bg-white shadow-none"
                      />
                      <Button
                        variant="outline"
                        className="rounded-lg border-[#dce4e1] bg-white"
                        onClick={() => {
                          handleCreatePeriod(newPeriodMonth)
                          setShowNewPeriodForm(false)
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                  {currentPeriodBundle && (
                    <Button
                      variant="outline"
                      className="w-full rounded-lg border-[#ead7d7] bg-white text-[#8a3d3d] hover:bg-[#fff4f4]"
                      onClick={() => {
                        const confirmed = window.confirm(`Delete ${formatMonthLabel(currentPeriodBundle.period.monthKey)}? This removes its imports, matches, notes, and overrides.`)
                        if (!confirmed) return
                        void handleDeletePeriod()
                      }}
                    >
                      <Trash2 />
                      Delete month
                    </Button>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-3">
              <div className="px-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Workflow</p>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const href = buildCurrentPath(item.page)

                  if (!href) {
                    return (
                      <div
                        key={item.page}
                        className="rounded-xl px-3 py-3 text-[#6d827c]"
                      >
                        <div>
                          <p className="text-sm font-medium tracking-tight">{item.label}</p>
                          <p className="mt-1 text-xs">{item.description}</p>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.page}
                      to={href}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-xl px-3 py-3 transition-colors duration-150',
                          isActive
                            ? 'bg-white text-[#102d28]'
                            : 'text-[#5f7670] hover:bg-white/70 hover:text-[#102d28]',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <div>
                          <p className="text-sm font-medium tracking-tight">{item.label}</p>
                          <p className={cn('mt-1 text-xs', isActive ? 'text-[#5f7670]' : 'text-[#6d827c]')}>
                            {item.description}
                          </p>
                        </div>
                      )}
                    </NavLink>
                  )
                })}
              </nav>
            </div>

            <section className="mt-auto space-y-3 border border-[#e2e8e5] bg-white px-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium tracking-tight text-[#102d28]">This month at a glance</p>
                <p className="text-xs leading-5 text-[#617a73]">
                  Keep the open work visible while you move between files, review, and follow-up.
                </p>
              </div>
              <div className="grid gap-0 divide-y divide-[#e2e8e5] rounded-xl border border-[#e2e8e5] bg-[#fafcfb] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
                <SidebarMetric label="Need review" value={stats?.ambiguous ?? 0} />
                <SidebarMetric label="Need support" value={stats?.unmatched ?? 0} />
                <SidebarMetric label="Files" value={importsCount} />
                <SidebarMetric label="Transactions" value={recordsCount} />
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-lg border-[#dce4e1] bg-white" onClick={handleLoadSampleSnapshot}>
                <RefreshCcw />
                Load sample
              </Button>
              <Button asChild variant="ghost" className="rounded-lg text-muted-foreground">
                <Link to="/">Marketing site</Link>
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[#dbe3e0] bg-[#f7f9f8]/92 backdrop-blur-xl">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#68817a]">
                  <span>{currentWorkspace?.workspace.name ?? 'Workspace'}</span>
                  <span className="text-[#9aacaa]">/</span>
                  <span>{currentPeriodBundle ? formatMonthLabel(currentPeriodBundle.period.monthKey) : 'No month selected'}</span>
                </div>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between">
                  <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                    {pageTitle}
                  </h1>
                  <WorkflowRail currentPage={currentPage} />
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex flex-wrap gap-2">
                  {currentPage !== 'imports' && importPath && (
                    <Button asChild className="rounded-lg bg-[#173f39] text-white hover:bg-[#0f312b]">
                      <NavLink to={importPath}>Import a CSV</NavLink>
                    </Button>
                  )}
                  {currentPage !== 'imports' && !importPath && (
                    <Button className="rounded-lg bg-[#173f39] text-white hover:bg-[#173f39]" disabled>
                      Import a CSV
                    </Button>
                  )}
                  {currentPage !== 'imports' && (
                    <Button
                      variant="outline"
                      className="rounded-lg border-[#dce4e1] bg-white"
                      onClick={handleExportFollowUp}
                      disabled={!currentPeriodBundle}
                    >
                      <Download />
                      Export follow-up
                    </Button>
                  )}
                  {!userSignedIn ? (
                    <Button
                      variant="outline"
                      className="rounded-lg border-[#dce4e1] bg-white"
                      onClick={handleDirectSignIn}
                      disabled={!cloudEnabled}
                    >
                      <LogIn />
                      {cloudEnabled ? 'Sign in' : 'Cloud unavailable'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="rounded-lg border-[#dce4e1] bg-white"
                        onClick={handleManualSave}
                        disabled={syncing}
                      >
                        <Save />
                        {syncing ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button variant="outline" className="rounded-lg border-[#dce4e1] bg-white" onClick={handleSignOut}>
                        <LogOut />
                        Sign out
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#617a73]">
                  <div className="inline-flex items-center gap-1.5">
                    <Cloud aria-hidden="true" className="size-3.5" />
                    {loadingCloud
                      ? 'Loading synced workspace...'
                      : userSignedIn
                        ? userEmail ?? 'Signed in'
                        : 'Sample mode'}
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <ShieldCheck aria-hidden="true" className="size-3.5" />
                    {!cloudEnabled
                      ? 'Firebase not configured'
                      : !authReady
                        ? 'Checking session...'
                        : userSignedIn
                          ? 'Cloud sync available'
                          : 'Demo workspace active'}
                  </div>
                </div>

                {cloudMessage && (
                  <p className="max-w-xl text-right text-xs leading-5 text-[#617a73]">{cloudMessage}</p>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

function SidebarMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-end justify-between px-3 py-3">
      <p className="text-sm text-[#617a73]">{label}</p>
      <p className="text-lg font-semibold tracking-tight text-[#102d28] [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  )
}

function WorkflowRail({ currentPage }: { currentPage: 'queue' | 'imports' | 'follow-up' }) {
  const steps = [
    { label: 'Files', active: currentPage === 'imports' },
    { label: 'Review', active: currentPage === 'queue' },
    { label: 'Follow-up', active: currentPage === 'follow-up' },
  ]

  return (
    <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#68817a]">
      {steps.map((step, index) => (
        <div key={step.label} className="inline-flex items-center gap-2">
          {index > 0 && <ArrowRight aria-hidden="true" className="size-3 text-[#9aacaa]" />}
          <span className={step.active ? 'text-[#173f39]' : undefined}>{step.label}</span>
        </div>
      ))}
    </div>
  )
}
