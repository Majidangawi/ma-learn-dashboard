# Sheet schema

The contract between the dashboard backend and the Google Sheet. Staging and production both conform to this exactly. Column order matters — the live `validate_coupon` Apps Script reads by column index.

## Customers
`Email | Name | Product | AmountSAR | PurchasedAt | Token | Source`

## Tokens
`Token | Product | Email | Status | AssignedAt`

## Lessons
`LessonID | Course | Module | Title | Active | Order | VideoID | ...other columns preserved`

## Coupons
`Code | Type | Value | Min Amount (SAR) | Uses Left | Start Date | End Date | Active | Products | CreatedAt | CreatedBy | Scope`

Columns A–H are read by the live checkout's `validate_coupon`. Do not reorder. Columns I–L were added by Plan 2 for dashboard-level metadata. Existing rows are backfilled with `Products=all`, `CreatedAt=2026-04-01T00:00:00`, `CreatedBy=legacy`.

## LinkInBio
`LinkID | TitleAR | TitleEN | URL | Icon | Description | Active | Order | ClickCount`

## LinkInBioHeader
`Key | Value`

Three seed rows: `PhotoURL`, `TaglineAR`, `TaglineEN`.

## EmailTemplates
`TemplateID | Name | SubjectAR | SubjectEN | BodyAR | BodyEN | Variables`

`Variables` is a csv of required template variables, e.g., `name,token,module,playerURL`.

## AuditLog
`Timestamp | Actor | Tool | Inputs | Output | Approval | IdempotencyKey`

## NoorActions
`ActionID | RequestedAt | Prompt | Plan | ApprovedAt | ExecutedAt | Result | Status`
