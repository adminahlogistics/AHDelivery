# AH Parcel Delivery

AH Parcel Delivery is a Next.js parcel-booking and delivery-operations app. It
includes a public landing page and booking flow, MongoDB-backed delivery
requests, a local-demo back office, rider profiles and delivery status updates.

## Local development

Requirements: Node.js/npm and a MongoDB database.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local `.env.local` file with your MongoDB connection string:

   ```text
   MONGODB_URI=mongodb://127.0.0.1:27017/ah_parcel_delivery
   ```

   Do not commit environment files or credentials. Existing environment files
   are not modified by the app setup.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000). The back office is at
   `/admin`, rider demo portal at `/rider`, and rider profile management at
   `/admin/riders`.

## Demo-mode limitations

The admin and rider interfaces and their operational APIs are intentionally
available without authentication only when `NODE_ENV=development`. The UI
labels this as local demo mode. The rider selector is only a way to exercise
the delivery workflow; it does not authenticate a rider. Do not expose a
development server or demo back office to the public internet.

Demo checkout marks a delivery booking as paid in the local database. It does
not contact a payment provider and does not charge money. Guest bookings are
identified by an idempotency key and are not associated with a customer login.
Rider profiles are operational MongoDB records; creating one does not email an
invitation or create a login account.

## Production requirements

There is no production authentication provider configured. Admin and rider
pages show an unavailable state, and privileged admin/rider API operations
return HTTP 503 outside development. Do not deploy these workflows until a
real server-verified authentication provider and role/ownership checks have
been integrated. Demo payment is also disabled outside development; configure
a real payment gateway and verify provider callbacks before accepting payments.

Set `MONGODB_URI` to the production MongoDB connection string using the hosting
platform's secret/environment-variable manager. Do not commit it. The app does
not run destructive database migrations.

## Useful commands

```bash
npm run dev
npm run build
npm start
```
