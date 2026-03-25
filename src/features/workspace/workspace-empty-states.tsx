import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ReconMark } from '@/components/brand/ReconBrand'
import { Button } from '@/components/ui/button'

type EmptyStateAction = {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'outline' | 'ghost'
  icon?: ReactNode
  disabled?: boolean
}

type EmptyStateStep = {
  title: string
  body: string
}

export function WorkspaceChecklistState({
  eyebrow,
  title,
  description,
  steps,
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: {
  eyebrow: string
  title: string
  description: string
  steps: EmptyStateStep[]
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  tertiaryAction?: EmptyStateAction
}) {
  return (
    <section className="rounded-[28px] border border-[#dde4e1] bg-[linear-gradient(180deg,#f8faf9_0%,#f4f8f6_100%)] p-5 shadow-[0_24px_60px_-48px_rgba(21,59,53,0.24)] sm:p-6">
      <div className="space-y-5">
        <div className="inline-flex items-center gap-3 rounded-[20px] border border-[#dbe7e2] bg-white/92 px-3.5 py-3 shadow-[0_18px_40px_-28px_rgba(21,59,53,0.35)]">
          <ReconMark className="h-10 w-10" alt="" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#5f7670]">
              Recon Workspace
            </p>
            <p className="text-sm tracking-tight text-[#173f39]">Keep files, review work, and follow-up on the same close.</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#5f7670]">
            {eyebrow}
          </p>
          <h2 className="max-w-2xl font-heading text-3xl font-semibold tracking-[-0.05em] text-[#102d28] text-balance">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-[#4c6660]">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <EmptyStateActionButton action={primaryAction} defaultVariant="default" />
          <EmptyStateActionButton action={secondaryAction} defaultVariant="outline" />
          <EmptyStateActionButton action={tertiaryAction} defaultVariant="ghost" />
        </div>

        <div className="rounded-[22px] border border-[#dbe4e1] bg-white/88 p-4 shadow-[0_18px_40px_-36px_rgba(21,59,53,0.25)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#5f7670]">
            Next steps
          </p>
          <ol className="mt-3 space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
                <div className="flex size-6 items-center justify-center rounded-full bg-[#edf5f2] text-[11px] font-semibold text-[#173f39]">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium tracking-tight text-[#102d28]">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#617a73]">{trimStepBody(step.body)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function trimStepBody(body: string) {
  const trimmed = body.trim()
  const match = trimmed.match(/^(.+?[.!?])(\s|$)/)
  return match?.[1] ?? trimmed
}

function EmptyStateActionButton({
  action,
  defaultVariant,
}: {
  action?: EmptyStateAction
  defaultVariant: 'default' | 'outline' | 'ghost'
}) {
  if (!action) return null

  const icon = action.icon ?? (defaultVariant === 'default' ? <ArrowRight aria-hidden="true" /> : null)
  const variant = action.variant ?? defaultVariant
  const commonClassName =
    variant === 'default'
      ? 'rounded-xl bg-[#173f39] text-white hover:bg-[#0f312b]'
      : variant === 'outline'
        ? 'rounded-xl border-[#cad7d4] bg-white'
        : 'rounded-xl text-muted-foreground'

  if (action.href) {
    return (
      <Button asChild variant={variant} className={commonClassName}>
        <Link to={action.href}>
          {action.label}
          {icon}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={commonClassName}
      onClick={action.onClick}
      disabled={action.disabled}
    >
      {action.label}
      {icon}
    </Button>
  )
}
