import { cn } from '@/lib/utils'

const RECON_EMOJI = '🗂️'

export function ReconMark({
  className,
  alt = 'Recon Workspace logo',
}: {
  className?: string
  alt?: string
}) {
  const decorative = alt === ''

  return (
    <span
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-[#153b35] p-[7%] shadow-[0_18px_40px_-28px_rgba(21,59,53,0.55)] ring-1 ring-white/35',
        className,
      )}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative ? true : undefined}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-full w-full items-center justify-center rounded-[0.95rem] bg-[#23524b] text-[1.7rem] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        {RECON_EMOJI}
      </span>
    </span>
  )
}

export function ReconLockup({
  className,
  markClassName,
  title = 'Recon Workspace',
  subtitle,
  titleClassName,
  subtitleClassName,
}: {
  className?: string
  markClassName?: string
  title?: string
  subtitle?: string
  titleClassName?: string
  subtitleClassName?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <ReconMark className={markClassName} alt="" />
      <div className="min-w-0">
        <p className={cn('text-sm font-medium tracking-tight text-foreground', titleClassName)}>{title}</p>
        {subtitle ? (
          <p className={cn('text-xs text-muted-foreground', subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
