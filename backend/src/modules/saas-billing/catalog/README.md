# SaaS Billing Catalog

The Catalog is the commercial source of truth for SchoolOS.

It defines every product that can be sold to a tenant.

---

## Pricing Plans

Represents subscription plans.

Examples

- Essential
- Professional
- Enterprise

Each plan defines:

- pricing model
- billing cycle
- limits
- features
- visibility
- version
- effective dates

---

## Pricing Addons

Represents optional purchasable items.

Examples

- Data Migration
- Setup Fee
- WhatsApp Credits
- SMS Pack
- Extra Branch
- Premium Support

---

## Rules

Plans are immutable business products.

Historical invoices must never change when a plan changes.

Subscriptions store snapshots of plans.

Invoices store snapshots of subscriptions.
