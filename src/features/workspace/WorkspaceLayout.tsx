import { useState } from 'react'
import {
  ArrowRight,
  Download,
  FolderPlus,
  LogOut,
  PencilLine,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { ReconLockup } from '@/components/brand/ReconBrand'
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
    buildCurrentPath,
    cloudMessage,
    currentPage,
    currentPeriodBundle,
    currentWorkspace,
    handleCreatePeriod,
    handleCreateWorkspace,
    handleDeleteSampleWorkspace,
    handleDeletePeriod,
    handleDeleteWorkspace,
    handleExportFollowUp,
    handleManualSave,
    handleRenameWorkspace,
    handleSignOut,
    isCurrentWorkspaceSample,
    loadingCloud,
    navigateToPeriod,
    navigateToWorkspace,
    setCloudMessage,
    setShowNewPeriodForm,
    setShowNewWorkspaceForm,
    showNewPeriodForm,
    showNewWorkspaceForm,
    snapshot,
    stats,
    syncing,
    userEmail,
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
  const currentWorkspaceName = currentWorkspace?.workspace.name ?? 'Choose a client'
  const currentMonthName = currentPeriodBundle ? formatMonthLabel(currentPeriodBundle.period.monthKey) : 'Choose a month'
  const importPath = currentPage !== 'imports' ? buildCurrentPath('imports') : null
  const pageTitle =
    currentPage === 'imports'
      ? 'Bring in this month’s files'
      : currentPage === 'follow-up'
        ? 'What still needs follow-up'
        : 'Transactions that still need attention'

  return (
    <div className="min-h-screen bg-[#eff3f2] text-foreground lg:h-dvh lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-full lg:min-h-0 lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="border-b border-[#dbe3e0] bg-[#f7f9f8] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 lg:min-h-full lg:px-5 lg:py-5">
            <div className="space-y-4">
              <Link to="/" className="inline-flex">
                <ReconLockup
                  subtitle="A cleaner month-end review workspace"
                  markClassName="h-11 w-11"
                  titleClassName="text-sm text-foreground"
                  subtitleClassName="text-xs text-muted-foreground"
                />
              </Link>

              <section className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Client</p>
                      <p className="mt-1 text-sm font-medium tracking-tight text-foreground">
                        {currentWorkspaceName}
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
                  {currentWorkspace && !isCurrentWorkspaceSample && (
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
                        {currentMonthName}
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
                  {currentPeriodBundle && !isCurrentWorkspaceSample && (
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

            <section className="mt-auto space-y-4 border border-[#e2e8e5] bg-white px-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium tracking-tight text-[#102d28]">Current work record</p>
                <p className="text-xs leading-5 text-[#617a73]">
                  Pick a client first, choose the month you are closing, then move through files, review, and follow-up.
                </p>
              </div>
              <div className="space-y-3 rounded-xl border border-[#e2e8e5] bg-[#fafcfb] p-3">
                <ContextRow label="Client" value={currentWorkspaceName} />
                <ContextRow label="Month" value={currentMonthName} />
                <ContextRow
                  label="Workflow"
                  value={
                    currentPage === 'imports'
                      ? 'Files'
                      : currentPage === 'follow-up'
                        ? 'Follow-up'
                        : 'Review'
                  }
                />
              </div>
              <div className="grid gap-0 divide-y divide-[#e2e8e5] rounded-xl border border-[#e2e8e5] bg-[#fafcfb] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
                <SidebarMetric label="Need review" value={stats?.ambiguous ?? 0} />
                <SidebarMetric label="Need support" value={stats?.unmatched ?? 0} />
                <SidebarMetric label="Files" value={importsCount} />
                <SidebarMetric label="Transactions" value={recordsCount} />
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="ghost" className="rounded-lg text-muted-foreground">
                <Link to="/">View home page</Link>
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex min-h-screen flex-col lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
          <header className="border-b border-[#dbe3e0] bg-[#f7f9f8]/92 backdrop-blur-xl lg:sticky lg:top-0 lg:z-20 lg:shrink-0">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#68817a]">
                  <span>{currentWorkspaceName}</span>
                  <span className="text-[#9aacaa]">/</span>
                  <span>{currentMonthName}</span>
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
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#617a73]">
                  <div className="inline-flex items-center gap-1.5">
                    {loadingCloud ? 'Loading saved client records...' : userEmail ?? 'Signed in'}
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <ShieldCheck aria-hidden="true" className="size-3.5" />
                    Changes save to your account
                  </div>
                </div>

                {cloudMessage && (
                  <p className="max-w-xl text-right text-xs leading-5 text-[#617a73]">{cloudMessage}</p>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 sm:px-6 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:px-8 lg:py-6 xl:overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              {isCurrentWorkspaceSample && (
                <section className="mb-4 flex flex-col gap-4 border border-[#ead7d7] bg-[#fff7f5] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#8a3d3d]">
                      Sample data
                    </p>
                    <p className="text-sm leading-6 text-[#6f4a4a]">
                      This workspace is here to show the product in context. Delete the sample data when you are ready to upload your own files.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl border-[#d8c5c5] bg-white"
                      onClick={() => {
                        setShowNewWorkspaceForm(true)
                        setCloudMessage('Create your own client workspace, then delete the sample data when you are ready.')
                      }}
                    >
                      <FolderPlus />
                      Create my workspace
                    </Button>
                    <Button
                      className="rounded-xl bg-[#9b3f3f] text-white hover:bg-[#842f2f]"
                      onClick={() => {
                        const confirmed = window.confirm('Delete sample data? This removes the sample workspace and leaves only your own workspaces.')
                        if (!confirmed) return
                        void handleDeleteSampleWorkspace()
                      }}
                    >
                      <Trash2 />
                      Delete sample data
                    </Button>
                  </div>
                </section>
              )}
              <Outlet />
            </div>
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

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#617a73]">{label}</p>
      <p className="text-right text-sm font-medium tracking-tight text-[#102d28]">{value}</p>
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
