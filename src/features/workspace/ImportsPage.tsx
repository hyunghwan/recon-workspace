import { useRef, useState } from 'react'
import { Lock, LogIn, Upload } from 'lucide-react'

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
import type { ImportFormState, SourceType } from '@/types'
import { sourceTypeLabel, sourceTypeOrder } from '@/utils'
import { WorkspaceChecklistState } from './workspace-empty-states'
import { useWorkspace } from './workspace-context'
import { SourceBadge } from './workspace-shared'
import { defaultImportForm } from './workspace-utils'

export default function ImportsPage() {
  const {
    cloudEnabled,
    currentPeriodBundle,
    handleImportBatch,
    handleImportSignIn,
    handleLoadSampleSnapshot,
    importing,
    setShowNewPeriodForm,
    userSignedIn,
  } = useWorkspace()
  const [importForm, setImportForm] = useState<ImportFormState>(defaultImportForm)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
      <section className="overflow-hidden border border-[#dde4e1] bg-white">
        <div className="space-y-3 border-b border-[#e5ece9] px-5 py-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#617a73]">
            Files {'->'} Review
          </p>
          <h2 className="text-lg font-semibold tracking-tight text-[#102d28]">
            Bring in the files for this month
          </h2>
          <p className="text-sm leading-6 text-[#617a73]">
            Choose the file type, attach the CSV, and add it to the current month so review stays tied to the same work.
          </p>
        </div>

        <div className="grid gap-px border-b border-[#e5ece9] bg-[#e5ece9] sm:grid-cols-3">
          <ImportStep
            number="01"
            title="Choose the file type"
            body="Statement, payout export, or supporting file."
          />
          <ImportStep
            number="02"
            title="Add the CSV"
            body="Attach the file to the month you are closing."
          />
          <ImportStep
            number="03"
            title="Move back into review"
            body="The review list updates as soon as the import finishes."
          />
        </div>

        {!userSignedIn && (
          <div className="border-b border-[#eadfbb] bg-[#fbf7ee] px-5 py-4 text-sm text-[#73541b]">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-3">
                <p>
                  Importing original CSV files still requires Google sign-in because files are stored in Firebase Storage.
                </p>
                <Button
                  variant="outline"
                  className="rounded-lg border-[#ead7b8] bg-white text-[#73541b] hover:bg-[#f8f1e3]"
                  onClick={handleImportSignIn}
                  disabled={!cloudEnabled}
                >
                  <LogIn />
                  {cloudEnabled ? 'Sign in to import' : 'Cloud unavailable'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!cloudEnabled && (
          <div className="border-b border-[#e5ece9] bg-[#fafcfb] px-5 py-4 text-sm text-[#617a73]">
            Firebase is not configured yet. You can browse sample workspaces, but live upload remains disabled.
          </div>
        )}

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>File type</Label>
              <Select
                value={importForm.sourceType}
                onValueChange={(value) => setImportForm((current) => ({ ...current, sourceType: value as SourceType }))}
              >
                <SelectTrigger aria-label="File type" className="w-full rounded-lg border-slate-200 bg-slate-50 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypeOrder.map((sourceType) => (
                    <SelectItem key={sourceType} value={sourceType}>
                      {sourceTypeLabel(sourceType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-key">Project</Label>
              <Input
                id="project-key"
                autoComplete="off"
                name="project-key"
                value={importForm.projectKey}
                onChange={(event) => setImportForm((current) => ({ ...current, projectKey: event.target.value }))}
                placeholder="ecommerce..."
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
                placeholder="operating-bank..."
                className="rounded-lg border-slate-200 bg-slate-50 shadow-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input
              id="csv-file"
              ref={fileInputRef}
              name="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="rounded-lg border-slate-200 bg-slate-50 shadow-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-lg bg-[#173f39] text-white hover:bg-[#0f312b]"
              onClick={async () => {
                await handleImportBatch({ file: selectedFile, form: importForm })
                setSelectedFile(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              disabled={importing}
            >
              <Upload />
              {importing ? 'Importing...' : 'Upload file'}
            </Button>
            <Button asChild variant="outline" className="rounded-lg border-slate-200 bg-white">
              <a href="/sample-statement.csv" download>
                Statement template
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-lg border-slate-200 bg-white">
              <a href="/sample-payout.csv" download>
                Payout template
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-lg border-slate-200 bg-white">
              <a href="/sample-supporting.csv" download>
                Supporting template
              </a>
            </Button>
          </div>

          <div className="grid gap-3 border-t border-[#e5ece9] pt-4 text-sm leading-6 text-[#617a73] sm:grid-cols-3">
            <p>Statement, payout, and supporting files all stay attached to the same month.</p>
            <p>Project and account details stay with the file so filtering still works later.</p>
            <p>Review and follow-up always point back to the original uploaded files.</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border border-[#dde4e1] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e5ece9] px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#102d28]">Files in this month</h2>
            <p className="mt-1 text-sm leading-6 text-[#617a73]">
              Review and follow-up both pull from the same monthly file list.
            </p>
          </div>
          <p className="text-sm text-[#617a73]">
            {currentPeriodBundle?.imports.length ?? 0} file{currentPeriodBundle?.imports.length === 1 ? '' : 's'}
          </p>
        </div>

        {!currentPeriodBundle?.imports.length ? (
          <div className="p-5">
            <WorkspaceChecklistState
              eyebrow="No files yet"
              title="This month is ready for its first upload."
              description="Use the form on the left to add the statement, payout export, or support file for this month. Once the first file lands, review and follow-up will fill in from there."
              secondaryAction={{
                label: 'Create month',
                onClick: () => setShowNewPeriodForm(true),
              }}
              tertiaryAction={
                !userSignedIn
                  ? {
                      label: 'Open sample month',
                      onClick: handleLoadSampleSnapshot,
                    }
                  : undefined
              }
              steps={[
                {
                  title: 'Bring in the month’s files',
                  body: 'Upload the first statement, payout export, or support file for the close month you are working on.',
                },
                {
                  title: 'Review what still needs attention',
                  body: 'The review page will fill in with the transactions that still need support or a closer look.',
                },
                {
                  title: 'Send follow-up only when needed',
                  body: 'The follow-up page will stay focused on the items that are still open after review.',
                },
              ]}
            />
          </div>
        ) : (
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
        )}
      </section>
    </div>
  )
}

function ImportStep({
  number,
  title,
  body,
}: {
  number: string
  title: string
  body: string
}) {
  return (
    <div className="bg-[#fafcfb] px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#617a73]">{number}</p>
      <p className="mt-3 text-sm font-medium tracking-tight text-[#102d28]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#617a73]">{body}</p>
    </div>
  )
}
