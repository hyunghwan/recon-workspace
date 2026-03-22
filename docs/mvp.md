# MVP Scope

## MVP goal
Ship a useful, demoable reconciliation workspace that feels real enough to validate with bookkeepers.

## User story
As a bookkeeper, I want to review a statement, see which transactions are matched or unresolved, and keep a clean record of what still needs documents or follow-up.

## In-scope for MVP
### 1. Workspace shell
- dashboard
- client/workspace selector
- statement import area (mock/demo in first version)

### 2. Reconciliation table
Each transaction row should show:
- date
- merchant / memo
- amount
- account/source
- status
- matched document count
- notes

### 3. Status system
Statuses:
- matched
- missing docs
- needs review
- exception
- ignored

### 4. Transaction detail panel
For one selected item:
- transaction summary
- suggested match area
- attached documents list
- internal note
- activity log

### 5. Missing-doc workflow
- filter unresolved items
- see count by status
- generate a follow-up summary or export list

### 6. Demo data
Include a realistic sample workspace so the product can be shown immediately.

## Explicitly out of scope
- direct accounting integrations
- OCR pipeline
- true AI matching engine
- login/auth
- multi-user roles
- billing
- email sending
- production-grade storage

## MVP narrative
The MVP should communicate:
- what the product is
- how the workflow works
- why unresolved exceptions are the wedge

## Validation questions
1. Would a bookkeeper use this instead of spreadsheets + notes?
2. Are the statuses and views intuitive?
3. Is missing-doc follow-up painful enough to pay for?
4. Which import source is most valuable to support first?
