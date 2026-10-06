---
name: Rajshah Poultry Farm
description: Product context and daily operating workflow for the farm's order and billing app.
---

The product is for Rajshah Poultry Farm, a broiler chicken supplier. Orders are counted in whole birds and total kilograms, then priced from the daily mandi rate. The user's father sets the daily market rate.

**Why:** The app was previously a general order-billing tool; future changes must preserve the poultry supplier workflow rather than drifting back to generic retail billing.

New customer records use only customer name, phone/WhatsApp, and address. Later cash or UPI collections pay the oldest unpaid bills first. Historical bills without saved payment data must remain accessible but must not be guessed as paid or unpaid.

**Why:** The new directory is for customer contact details, while historical shop/owner fields still need read-only compatibility. Guessing old payment status could create false customer debt.

**How to apply:** Keep broiler pieces, kilograms, daily mandi rates, oldest-bill-first collections, and the supplied farm identity central to future changes. Read legacy shop, owner, and WhatsApp fields only to preserve old records.
