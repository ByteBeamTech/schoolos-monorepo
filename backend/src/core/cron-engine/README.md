# cron-engine

Central scheduler for all SchoolOS timed jobs.
Uses BullMQ + node-cron.

## Job Registry

| Job | Schedule | Description |
|-----|----------|-------------|
| billing-cycle | 1st of month 00:01 | Generate SaaS invoices for all active tenants |
| fee-reminders | Daily 08:00 | Send fee due/overdue reminders to parents |
| attendance-summary | Daily 17:00 | Send daily attendance summary to parents |
| dunning-retry | Every 6 hours | Retry failed SaaS subscription payments |
| report-generation | Sunday 23:00 | Pre-generate weekly reports |
| student-count-snapshot | Daily 23:59 | Snapshot active student count per tenant |
| session-expiry | Daily 02:00 | Clean up expired sessions |
| late-fee-calculation | Daily 00:30 | Apply late fees to overdue invoices |

## Rule

Never call cron-engine from a module.
Modules fire events. cron-engine listens and executes.
New job = new file in jobs/{domain}/ + entry in registry/.
