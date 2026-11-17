# AH Parcel Delivery

AH Parcel Delivery is a Next.js parcel-booking and delivery-operations app. It
includes a public landing page and booking flow, MongoDB-backed delivery
requests, a local-demo back office, rider profiles and delivery status updates.
Admins can choose direct delivery or hub sorting for pending jobs, track hub
receipts, assign final-delivery riders and reassign active jobs.
Riders can record kilometers for each completed route leg; the portal totals
those manually entered distances and the orders handled by the selected rider.

Customers can place one order for up to 20 recipients using a shared sender
and pickup address. Each recipient is tracked as an individual delivery and
can be paid for at checkout or marked pay-on-delivery. New demo bookings use a
₦5,000 fee per delivery; the checkout total includes only the sender-paid
deliveries. Riders can confirm pay-on-delivery cash collection or share a
payment link for an unpaid recipient delivery. The back office groups
deliveries by order and shows each delivery's payer and payment status.

For hub-sorting jobs in local development, set the route to “Bring to hub” and
select Yaba, Oshodi or Island before assigning a rider. The rider marks the
first leg received at the hub; an admin can then assign a rider for final
delivery.

## Local development

Requirements: Node.js/npm and a MongoDB database.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local `.env.local` file with your MongoDB connection string:

   ```text
   MONGODB_URI=mongodb://127.0.0.1:27017/ah_parcel_delivery
   RIDER_PII_ENCRYPTION_KEY=<base64-encoded 32-byte key>
   ```

   Generate the encryption key with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
   Keep this key in a secret manager, use the same key for each app instance,
   and back it up securely. Losing or changing it makes saved rider onboarding
   details and rider documents unreadable.

   Do not commit environment files or credentials. Existing environment files
   are not modified by the app setup.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000). The back office is at
   `/admin`, customer records at `/admin/customers`, and rider profile
   management at `/admin/riders`. The rider portal at `/rider` is temporarily
   disabled. The homepage header links to the back office.

## Demo-mode limitations

The admin interface and its operational APIs are intentionally available
without authentication only when `NODE_ENV=development`. The rider portal and
its operational APIs are currently disabled. If re-enabled, the rider selector
is only a way to exercise the delivery workflow; it does not authenticate a
rider. Do not expose a development server or demo back office to the public
internet.

Demo checkout marks sender-paid deliveries in an order as paid in the local
database. A rider's recipient payment link can also mark one pay-on-delivery
delivery as paid in the local demo. Neither flow contacts a payment provider
or charges money. Rider kilometers are manually entered per completed trip
leg; they are not GPS-tracked or independently verified. Guest bookings are
identified by an idempotency key
and are not associated with a customer login. Customer records are derived
from delivery senders' phone numbers, not customer accounts.
Rider profiles are operational MongoDB records; creating one does not email an
invitation or create a login account.

Rider addresses, BVNs, NINs, proof-of-address documents and NIN slips are
encrypted with `RIDER_PII_ENCRYPTION_KEY` before they are saved. The admin
onboarding editor shows only the last four digits of saved BVN/NIN values. NIN
submission requires an accompanying slip. Submitted proof-of-address documents
and NIN slips are reviewed from **Requests → Approvals** in the admin back
office. Replacing a document sends it back to pending approval. Keep the local
demo private; production use still requires real admin authentication and
authorization.

## Production requirements

There is no production authentication provider configured. Admin pages show an
unavailable state, and privileged admin/rider API operations return HTTP 503
outside development. The rider portal is currently disabled in all
environments. Do not deploy these workflows until a real server-verified
authentication provider and role/ownership checks have been integrated. Demo
payment is also disabled outside development; configure a real payment gateway
and verify provider callbacks before accepting payments.

Set `MONGODB_URI` to the production MongoDB connection string using the hosting
platform's secret/environment-variable manager. Do not commit it. The app does
not run destructive database migrations.

## Useful commands

```bash
npm run dev
npm run build
npm start
```
