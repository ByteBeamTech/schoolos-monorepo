# marketplace

Feature store for SchoolOS add-on modules.

## Add-on Tiers

| Add-on | Tier Required | Monthly (INR) | Monthly (USD) |
|--------|---------------|---------------|---------------|
| AI Engine | Growth+ | ₹2,000 | $25 |
| Hostel Management | Pro+ | ₹3,000 | $35 |
| Canteen Management | Pro+ | ₹1,500 | $18 |
| Alumni Network | Enterprise | ₹2,500 | $30 |
| Biometric Integration | Any | ₹1,000 | $12 |
| WhatsApp Notifications | Any | ₹800 | $10 |
| Advanced Analytics | Growth+ | ₹2,000 | $25 |
| Custom Domain | Any | ₹500 | $6 |

## Flow

catalog/       → defines available add-ons and pricing
add-ons/       → which tenants have which add-ons enabled
subscriptions/ → billing for add-ons (separate from base plan)
billing/       → invoice generation for add-on purchases
reviews/       → school reviews and ratings of add-ons
