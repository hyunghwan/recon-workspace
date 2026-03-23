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
    <section className="grid gap-6 border border-[#dde4e1] bg-[#f8faf9] p-6 lg:min-h-full lg:grid-cols-[minmax(0,0.92fr)_320px]">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-3 rounded-[22px] border border-[#dbe7e2] bg-white/90 px-3.5 py-3 shadow-[0_18px_40px_-28px_rgba(21,59,53,0.35)]">
          <ReconMark className="h-10 w-10" alt="" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#5f7670]">
              Recon Workspace
            </p>
            <p className="text-sm tracking-tight text-[#173f39]">Keep the month-end flow steady from upload to follow-up.</p>
          </div>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#5f7670]">
          {eyebrow}
        </p>
        <div className="space-y-3">
          <h2 className="font-heading text-3xl font-semibold tracking-[-0.05em] text-[#102d28] text-balance">
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
      </div>

      <ol className="divide-y divide-[#dde4e1] border border-[#dde4e1] bg-white">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-4"
          >
            <div className="flex size-8 items-center justify-center rounded-full border border-[#cad7d4] bg-[#edf5f2] text-xs font-semibold text-[#173f39]">
              {index + 1}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium tracking-tight text-[#102d28]">
                {step.title}
              </p>
              <p className="text-sm leading-6 text-[#617a73]">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
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
