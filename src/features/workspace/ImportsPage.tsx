import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Lock, LogIn, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  ImportBatchUploadResult,
  ImportFormState,
  QueuedImportFile,
  SourceType,
} from '@/types'
import {
  buildImportSelectionSummary,
  createDefaultImportForm,
  formatMonthLabel,
  inferImportSourceType,
  sourceTypeLabel,
  sourceTypeOrder,
} from '@/utils'
import { monthlyFixtureDownloads, sampleTemplateDownloads } from '@/sample-csv-fixtures'
import { WorkspaceChecklistState } from './workspace-empty-states'
import { useWorkspace } from './workspace-context'
import { SourceBadge } from './workspace-shared'

export default function ImportsPage() {
  const {
    cloudEnabled,
    currentPeriodBundle,
    currentWorkspace,
    handleImportBatch,
    handleImportSignIn,
    importing,
    navigateToPeriod,
    navigateToWorkspace,
    setShowNewPeriodForm,
    snapshot,
    userSignedIn,
  } = useWorkspace()
  const [importForm, setImportForm] = useState<ImportFormState>(() => createDefaultImportForm())
  const [queuedFiles, setQueuedFiles] = useState<QueuedImportFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [showOptionalTagging, setShowOptionalTagging] = useState(false)
  const [showTemplateHelp, setShowTemplateHelp] = useState(false)
  const [queueMessage, setQueueMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const clientName = currentWorkspace?.workspace.name ?? 'Choose a client'
  const monthName = currentPeriodBundle ? formatMonthLabel(currentPeriodBundle.period.monthKey) : 'Choose a month'
  const summaryItems = buildImportSelectionSummary({
    clientName,
    monthName,
    fileNames: queuedFiles.map((item) => item.file.name),
  })
  const unresolvedCount = queuedFiles.filter((item) => !item.resolvedSourceType).length
  const uploadDisabled =
    importing ||
    queuedFiles.length === 0 ||
    unresolvedCount > 0 ||
    !currentWorkspace ||
    !currentPeriodBundle ||
    !cloudEnabled ||
    !userSignedIn

  async function buildQueuedFile(file: File): Promise<QueuedImportFile> {
    let inference = inferImportSourceType({ fileName: file.name })

    try {
      const text = await file.text()
      inference = inferImportSourceType({
        fileName: file.name,
        text,
      })
    } catch {
      inference = {
        ...inference,
        inferenceReason: 'Could not read the file yet. Choose a type before uploading.',
      }
    }

    return {
      id: `queued_${crypto.randomUUID()}`,
      file,
      inferredSourceType: inference.inferredSourceType,
      resolvedSourceType: inference.inferredSourceType,
      inferenceStatus: inference.inferenceStatus,
      inferenceReason: inference.inferenceReason,
      error: null,
    }
  }

  function resetFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function queueCsvFiles(files: FileList | File[]) {
    const allFiles = Array.from(files)
    const csvFiles = allFiles.filter((file) => isCsvFile(file))
    const skippedCount = allFiles.length - csvFiles.length

    if (!csvFiles.length) {
      setQueueMessage('Only CSV files can be added here.')
      resetFilePicker()
      return
    }

    const nextQueuedFiles = await Promise.all(csvFiles.map((file) => buildQueuedFile(file)))
    setQueuedFiles((current) => [...current, ...nextQueuedFiles])

    const addedMessage = `${nextQueuedFiles.length} file${nextQueuedFiles.length === 1 ? '' : 's'} added to the queue.`
    setQueueMessage(
      skippedCount > 0
        ? `${addedMessage} ${skippedCount} non-CSV file${skippedCount === 1 ? '' : 's'} skipped.`
        : addedMessage,
    )
    resetFilePicker()
  }

  function removeQueuedFile(id: string) {
    setQueuedFiles((current) => current.filter((item) => item.id !== id))
  }

  function updateQueuedFile(id: string, update: Partial<QueuedImportFile>) {
    setQueuedFiles((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    )
  }

  async function uploadQueuedFiles() {
    const uploadItems = queuedFiles
      .filter((item) => item.resolvedSourceType)
      .map((item) => ({
        id: item.id,
        file: item.file,
        sourceType: item.resolvedSourceType as SourceType,
      }))

    const results = await handleImportBatch({
      files: uploadItems,
      form: importForm,
    })

    if (!results.length) return

    const completedIds = new Set(
      results
        .filter((result) => result.status === 'imported' || result.status === 'duplicate_skipped')
        .map((result) => result.id),
    )
    const failedById = new Map(
      results
        .filter((result) => result.status === 'failed')
        .map((result) => [result.id, result]),
    )

    setQueuedFiles((current) =>
      current
        .filter((item) => !completedIds.has(item.id))
        .map((item) => {
          const failure = failedById.get(item.id)
          if (!failure) return item
          return {
            ...item,
            error: failure.error ?? 'Upload failed for this file.',
          }
        }),
    )
    setQueueMessage(buildQueueResultMessage(results))
  }

  function handleDropzoneDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragActive(true)
  }

  function handleDropzoneDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragActive(false)
  }

  async function handleDropzoneDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragActive(false)
    if (event.dataTransfer.files.length > 0) {
      await queueCsvFiles(event.dataTransfer.files)
    }
  }

  return (
    <div className="grid gap-4 lg:flex-1 lg:min-h-0 xl:h-full xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
      <section className="overflow-hidden border border-[#dde4e1] bg-white xl:min-h-0 xl:overflow-y-auto">
        <div className="space-y-3 border-b border-[#e5ece9] px-5 py-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
            Files {'->'} Review
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-[#102d28]">
            Upload files, then confirm the queue
          </h2>
          <p className="text-sm leading-6 text-[#617a73]">
            Pick the client, confirm the month, then drag CSV files in or click to browse. Each file gets its own type check before the upload starts.
          </p>
        </div>

        <div className="border-b border-[#e5ece9] bg-[#f7faf9] px-5 py-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#617a73]">
            Selected upload target
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {summaryItems.map((item) => (
              <SelectionSummaryCard key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>

        {!userSignedIn && (
          <div className="border-b border-[#eadfbb] bg-[#fbf7ee] px-5 py-4 text-sm text-[#73541b]">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-3">
                <p>
                  Uploading original CSV files for {clientName} still requires Google sign-in so the files stay attached to {monthName}.
                </p>
                <Button
                  variant="outline"
                  className="rounded-lg border-[#ead7b8] bg-white text-[#73541b] hover:bg-[#f8f1e3]"
                  onClick={handleImportSignIn}
                  disabled={!cloudEnabled}
                >
                  <LogIn />
                  {cloudEnabled ? 'Sign in to upload' : 'Cloud unavailable'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!cloudEnabled && (
          <div className="border-b border-[#e5ece9] bg-[#fafcfb] px-5 py-4 text-sm text-[#617a73]">
            Sign-in is not configured yet. You can still explore the example client, but live uploads remain disabled.
          </div>
        )}

        <div className="space-y-4 px-5 py-5">
          <ImportStepCard
            number="01"
            title="Choose the client"
            body="Switch the client here if these files belong somewhere else."
          >
            <Select value={currentWorkspace?.workspace.id ?? ''} onValueChange={navigateToWorkspace}>
              <SelectTrigger aria-label="Choose the client" className="w-full rounded-lg border-slate-200 bg-slate-50 shadow-none">
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
          </ImportStepCard>

          <ImportStepCard
            number="02"
            title="Choose the month"
            body="Confirm the close month before you start adding files."
          >
            <Select value={currentPeriodBundle?.period.id ?? ''} onValueChange={navigateToPeriod}>
              <SelectTrigger aria-label="Choose the month" className="w-full rounded-lg border-slate-200 bg-slate-50 shadow-none">
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
          </ImportStepCard>

          <ImportStepCard
            number="03"
            title="Drag, drop, or browse for CSV files"
            body={`Everything in this queue will upload into ${clientName} for ${monthName}.`}
          >
            <div className="space-y-4">
              <button
                type="button"
                className={[
                  'flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-colors',
                  dragActive
                    ? 'border-[#173f39] bg-[#f3faf7]'
                    : 'border-[#cad7d4] bg-[#fafcfb] hover:bg-[#f7faf9]',
                ].join(' ')}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDropzoneDragOver}
                onDragLeave={handleDropzoneDragLeave}
                onDrop={handleDropzoneDrop}
              >
                <Upload className="size-6 text-[#173f39]" />
                <p className="mt-3 text-sm font-medium tracking-tight text-[#102d28]">
                  Drag CSV files here or click to browse
                </p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#617a73]">
                  You can add multiple files at once. We will infer the type for each file and ask you only when something is unclear.
                </p>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files?.length) {
                    void queueCsvFiles(event.target.files)
                  }
                }}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <SelectionSummaryCard label="Queued" value={`${queuedFiles.length} file${queuedFiles.length === 1 ? '' : 's'}`} />
                <SelectionSummaryCard label="Ready" value={`${queuedFiles.length - unresolvedCount}`} />
                <SelectionSummaryCard label="Type Needed" value={`${unresolvedCount}`} />
              </div>

              {queueMessage && (
                <div className="rounded-xl border border-[#dde4e1] bg-[#fafcfb] px-4 py-3 text-sm leading-6 text-[#617a73]">
                  {queueMessage}
                </div>
              )}

              {!queuedFiles.length ? (
                <div className="rounded-xl border border-[#dde4e1] bg-white px-4 py-4 text-sm leading-6 text-[#617a73]">
                  Add one or more CSV files to start building the upload queue.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#dde4e1] bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200">
                        <TableHead className="px-4">File</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[76px] text-right">Remove</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queuedFiles.map((item) => (
                        <TableRow key={item.id} className="border-slate-200/90">
                          <TableCell className="px-4 whitespace-normal">
                            <div className="space-y-1">
                              <p className="font-medium tracking-tight text-foreground">{item.file.name}</p>
                              <p className="text-sm text-muted-foreground">{item.inferenceReason}</p>
                              {item.error && <p className="text-sm text-[#a24949]">{item.error}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <Select
                              value={item.resolvedSourceType ?? ''}
                              onValueChange={(value) =>
                                updateQueuedFile(item.id, {
                                  resolvedSourceType: value as SourceType,
                                  inferenceStatus:
                                    item.inferredSourceType === value ? item.inferenceStatus : 'inferred',
                                  inferenceReason:
                                    item.inferredSourceType === value
                                      ? item.inferenceReason
                                      : 'Type set manually.',
                                  error: null,
                                })
                              }
                            >
                              <SelectTrigger aria-label={`Choose the file type for ${item.file.name}`} className="w-full rounded-lg border-slate-200 bg-slate-50 shadow-none">
                                <SelectValue placeholder="Type needed" />
                              </SelectTrigger>
                              <SelectContent>
                                {sourceTypeOrder.map((sourceType) => (
                                  <SelectItem key={sourceType} value={sourceType}>
                                    {sourceTypeLabel(sourceType)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {item.resolvedSourceType && (
                              <div className="mt-2">
                                <SourceBadge sourceType={item.resolvedSourceType} />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <QueueStatusBadge item={item} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              className="rounded-lg text-muted-foreground"
                              onClick={() => removeQueuedFile(item.id)}
                            >
                              <X />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="rounded-xl border border-[#dde4e1] bg-white px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium tracking-tight text-[#102d28]">Optional tagging</p>
                    <p className="text-sm leading-6 text-[#617a73]">
                      If you open this, the same project and account labels will apply to every file still in the queue.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg border-slate-200 bg-white"
                    onClick={() => setShowOptionalTagging((current) => !current)}
                  >
                    {showOptionalTagging ? 'Hide details' : 'Add details'}
                    {showOptionalTagging ? <ChevronUp /> : <ChevronDown />}
                  </Button>
                </div>

                {showOptionalTagging && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="project-key">Project</Label>
                      <Input
                        id="project-key"
                        autoComplete="off"
                        name="project-key"
                        value={importForm.projectKey}
                        onChange={(event) => setImportForm((current) => ({ ...current, projectKey: event.target.value }))}
                        placeholder="Optional project label"
                        className="rounded-lg border-slate-200 bg-slate-50 shadow-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account-key">Account</Label>
                      <Input
                        id="account-key"
                        autoComplete="off"
                        name="account-key"
                        value={importForm.accountKey}
                        onChange={(event) => setImportForm((current) => ({ ...current, accountKey: event.target.value }))}
                        placeholder="Optional account label"
                        className="rounded-lg border-slate-200 bg-slate-50 shadow-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#dde4e1] bg-white px-4 py-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setShowTemplateHelp((current) => !current)}
                >
                  <div>
                    <p className="text-sm font-medium tracking-tight text-[#102d28]">Need sample files?</p>
                    <p className="mt-1 text-sm leading-6 text-[#617a73]">
                      Keep the downloads hidden unless you want quick templates or a realistic month pack.
                    </p>
                  </div>
                  {showTemplateHelp ? <ChevronUp className="text-[#617a73]" /> : <ChevronDown className="text-[#617a73]" />}
                </button>

                {showTemplateHelp && (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium tracking-tight text-[#102d28]">Quick templates</p>
                        <p className="text-sm leading-6 text-[#617a73]">
                          Small starter files for checking a column layout before you upload real data.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sampleTemplateDownloads.map((item) => (
                          <Button key={item.href} asChild variant="outline" className="rounded-lg border-slate-200 bg-white">
                            <a href={item.href} download>
                              {item.label}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-[#e5ece9] pt-4">
                      <div>
                        <p className="text-sm font-medium tracking-tight text-[#102d28]">Realistic month pack</p>
                        <p className="text-sm leading-6 text-[#617a73]">
                          Six realistic March files plus one generic export that should require a manual type choice.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {monthlyFixtureDownloads.map((item) => (
                          <Button key={item.href} asChild variant="outline" className="rounded-lg border-slate-200 bg-white">
                            <a href={item.href} download>
                              {item.label}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-lg bg-[#173f39] text-white hover:bg-[#0f312b]"
                  onClick={() => void uploadQueuedFiles()}
                  disabled={uploadDisabled}
                >
                  <Upload />
                  {importing
                    ? 'Uploading...'
                    : `Upload ${queuedFiles.length} file${queuedFiles.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </div>
          </ImportStepCard>

          <div className="grid gap-3 border-t border-[#e5ece9] pt-4 text-sm leading-6 text-[#617a73] sm:grid-cols-3">
            <p>Statement, payout, and supporting files can now be queued together before upload.</p>
            <p>Only files that still need a type selection block the upload button.</p>
            <p>Review and follow-up always point back to the original uploaded files for {clientName}.</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border border-[#dde4e1] bg-white xl:flex xl:min-h-0 xl:flex-col">
        <div className="flex flex-col gap-3 border-b border-[#e5ece9] px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#102d28]">Files for {clientName}</h2>
            <p className="mt-1 text-sm leading-6 text-[#617a73]">
              These files are currently attached to {monthName}. Review and follow-up both pull from this same list.
            </p>
          </div>
          <p className="text-sm text-[#617a73]">
            {currentPeriodBundle?.imports.length ?? 0} file{currentPeriodBundle?.imports.length === 1 ? '' : 's'}
          </p>
        </div>

        {!currentPeriodBundle?.imports.length ? (
          <div className="p-5 xl:flex-1 xl:min-h-0">
            <WorkspaceChecklistState
              eyebrow="No files yet"
              title={`${clientName} is ready for the first upload.`}
              description={`Use the queue on the left to add one or more CSV files for ${monthName}. Once the first upload finishes, review and follow-up will fill in from there.`}
              secondaryAction={{
                label: 'Create month',
                onClick: () => setShowNewPeriodForm(true),
              }}
              steps={[
                {
                  title: 'Choose the right client',
                  body: 'Make sure you are uploading into the correct client before building the queue.',
                },
                {
                  title: 'Confirm the month',
                  body: `Attach the first batch to ${monthName} so review and follow-up stay tied to the same close.`,
                },
                {
                  title: 'Upload the queue and keep moving',
                  body: 'As soon as files land, the review page can work from the same source list.',
                },
              ]}
            />
          </div>
        ) : (
          <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200">
                  <TableHead className="px-4">File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPeriodBundle.imports.map((item) => (
                  <TableRow key={item.id} className="border-slate-200/90">
                    <TableCell className="px-4 whitespace-normal">
                      <div className="space-y-1">
                        <p className="font-medium tracking-tight text-foreground">{item.fileName}</p>
                        <p className="text-sm text-muted-foreground">{new Date(item.uploadedAt).toLocaleString()}</p>
                      </div>
                    </TableCell>
                    <TableCell><SourceBadge sourceType={item.sourceType} /></TableCell>
                    <TableCell className="text-muted-foreground">{item.projectKey}</TableCell>
                    <TableCell className="text-muted-foreground">{item.accountKey}</TableCell>
                    <TableCell>{item.rowCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

function SelectionSummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-[#dde4e1] bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#617a73]">{label}</p>
      <p className="mt-2 text-sm font-medium tracking-tight text-[#102d28]">{value}</p>
    </div>
  )
}

function ImportStepCard({
  number,
  title,
  body,
  children,
}: {
  number: string
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#dde4e1] bg-[#fafcfb] p-4">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#617a73]">{number}</p>
        <div className="space-y-1">
          <p className="text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
          <p className="text-sm leading-6 text-[#617a73]">{body}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function QueueStatusBadge({ item }: { item: QueuedImportFile }) {
  const toneClassName = !item.resolvedSourceType
    ? 'border-[#eadfbb] bg-[#fbf7ee] text-[#73541b]'
    : item.error
      ? 'border-[#ead7d7] bg-[#fff4f4] text-[#8a3d3d]'
      : 'border-[#dde4e1] bg-[#f7faf9] text-[#173f39]'
  const label = !item.resolvedSourceType
    ? 'Type needed'
    : item.error
      ? 'Retry needed'
      : item.inferredSourceType === item.resolvedSourceType && item.inferenceStatus === 'inferred'
        ? 'Auto-detected'
        : 'Type confirmed'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClassName}`}>
      {label}
    </span>
  )
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv' || file.type === ''
}

function buildQueueResultMessage(results: ImportBatchUploadResult[]) {
  const importedCount = results.filter((result) => result.status === 'imported').length
  const duplicateCount = results.filter((result) => result.status === 'duplicate_skipped').length
  const failedCount = results.filter((result) => result.status === 'failed').length
  const parts: string[] = []

  if (importedCount > 0) {
    parts.push(`${importedCount} file${importedCount === 1 ? '' : 's'} uploaded.`)
  }
  if (duplicateCount > 0) {
    parts.push(`${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} skipped.`)
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} file${failedCount === 1 ? '' : 's'} still need another try.`)
  }

  return parts.join(' ') || 'No upload results yet.'
}
