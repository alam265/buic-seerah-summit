# BRACUian Seerah Summit

**Live site:** [https://seerahsummit.vercel.app/](https://seerahsummit.vercel.app/)

Registration and event portal for **BRACUian Seerah Summit 1448**, organized by the [BRACUian Islamic Community (BUIC)](https://www.facebook.com/BRACUianIslamicCommunity/). Students can register for the Seerah competition, order the book *উসওয়াতুন হাসানাহ*, and explore quiz / open-book / seminar event pages. Admins manage participants, book orders, and email notifications.

## Features

- **Competition registration** — online signup with ticket ID, student details, and bKash payment reference
- **Book registration** — purchase flow for *উসওয়াতুন হাসানাহ* (৳150 for quiz participants, ৳220 otherwise), with participant lookup and public bKash number
- **Event pages** — Seerah Quiz Competition, Open Book Competition, and Grand Seerah Seminar
- **Admin dashboard** — JWT-protected panel to view, edit, delete registrations; manage book orders; export CSV; send bulk email to competition registrants
- **Neon PostgreSQL** — schema and indexes created automatically on startup
- **Optional SMTP** — bulk notifications to competition registrants (supports `{{fullName}}`, `{{ticketId}}`, etc. in templates)

## Tech stack

| Layer | Stack |
|--------|--------|
| Runtime | Node.js (CommonJS) |
| Server | Express |
| Database | PostgreSQL via [Neon](https://neon.tech) (`pg`) |
| Auth | JWT (`admin_token` cookie or `Authorization: Bearer`) + bcryptjs |
| Email | Nodemailer (SMTP) |
| Frontend | Static HTML / CSS / JS with server-injected header & footer partials |
| Hosting | [Vercel](https://vercel.com/) serverless (`vercel.json` + `@vercel/node`) |

## Project structure

```
seerah-summit/
├── server.js                 # App entry — Express bootstrap, DB init, Vercel export
├── vercel.json               # Vercel serverless routing (all traffic → server.js)
├── .env.example              # Environment variable template
├── src/
│   ├── config/db.js          # Neon pool, migrations, admin seed
│   ├── controllers/          # HTTP handlers
│   ├── services/             # Business logic (auth, registration, email, books)
│   ├── middlewares/          # Admin auth guards
│   ├── routes/
│   │   ├── pageRoutes.js     # HTML pages
│   │   └── apiRoutes.js      # /api/* endpoints
│   ├── db/schema.sql         # Reference schema
│   └── views/
│       ├── *.html            # Page templates
│       ├── partials/         # Shared header & footer (injected at render time)
│       ├── css/              # Stylesheets
│       └── js/               # Client-side logic (register, admin, book-register, etc.)
```

## Prerequisites

- Node.js 18+ (recommended)
- A Neon (or any PostgreSQL) database connection string

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd seerah-summit
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `PORT` | No | Server port (default `3000`) |
   | `DATABASE_URL` | Yes* | Neon / PostgreSQL connection string |
   | `ADMIN_USERNAME` | No | Seed admin username (default `admin`) |
   | `ADMIN_PASSWORD` | No | Seed admin password (default `admin123`) |
   | `JWT_SECRET` | Recommended | Secret for signing admin JWTs |
   | `BKASH_NUMBER` | Recommended | Public bKash Send Money number on book registration |
   | `SMTP_HOST` | For email | e.g. `smtp.gmail.com` |
   | `SMTP_PORT` | For email | e.g. `587` |
   | `SMTP_SECURE` | For email | `true` for port 465, else `false` |
   | `SMTP_USER` | For email | SMTP username |
   | `SMTP_PASS` | For email | SMTP password / app password |
   | `SMTP_FROM` | For email | From header, e.g. `"BUIC Quiz <you@gmail.com>"` |

   \*See [Local fallback mode](#local-fallback-mode) below.

   On first successful DB connect, if the `admins` table is empty, a default admin is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

3. **Run**

   ```bash
   npm start          # production
   npm run dev        # auto-restart on file changes (node --watch)
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Local fallback mode

When `DATABASE_URL` is missing or still contains the placeholder (`your_password_here`), the app boots without Neon and uses **in-memory storage**:

- Competition registrations and book orders are kept in process memory (lost on restart).
- Admin login uses `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` instead of the `admins` table.

If `DATABASE_URL` **is set** but Neon fails to connect, API writes return **503** (`DB_NOT_READY`) — they do **not** fall back to in-memory storage. Production must have a working `DATABASE_URL`.

## Deployment

The production site is hosted on [Vercel](https://vercel.com/) at [https://seerahsummit.vercel.app/](https://seerahsummit.vercel.app/).

- `vercel.json` routes all requests to `server.js` via `@vercel/node`.
- When `VERCEL` is set, `server.js` exports the Express app instead of calling `listen()`; `ensureDbReady()` warms the Neon connection on cold starts.
- Set the same environment variables from `.env.example` in the Vercel project settings — especially `DATABASE_URL`, `JWT_SECRET`, and SMTP credentials if using email.

## Pages

| Path | Description |
|------|-------------|
| `/` | Home — summit intro & events |
| `/about` | About BUIC / the summit |
| `/contact` | Contact & FAQ (client-side form only — no backend API) |
| `/register` | Competition registration |
| `/book-register` | Book purchase registration |
| `/events/quiz` | Seerah Quiz Competition details |
| `/events/open-book` | Open Book Competition details |
| `/events/grand-seminar` | Grand Seerah Seminar details |
| `/login` | Admin login |
| `/admin` | Admin dashboard (auth required) |

## API overview

Admin-protected routes accept the `admin_token` HTTP-only cookie (set on login) or an `Authorization: Bearer <token>` header.

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health / DB status, registration count, auth mode |
| `POST` | `/api/register` | Submit competition registration |
| `GET` | `/api/book-register/config` | Public book config (e.g. bKash number) |
| `POST` | `/api/book-register/lookup` | Look up participant by student ID (returns pricing) |
| `POST` | `/api/book-register` | Submit book order |

### Admin auth (no prior session)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Log in — sets `admin_token` cookie |
| `POST` | `/api/admin/logout` | Log out — clears cookie |

### Admin (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/me` | Current admin session |
| `GET` | `/api/participants` | List registrations |
| `PUT` | `/api/participants/:id` | Update a registration |
| `DELETE` | `/api/participants/:id` | Delete a registration |
| `GET` | `/api/book-orders` | List book orders |
| `DELETE` | `/api/book-orders/:id` | Delete a book order |
| `GET` | `/api/notifications/email/status` | SMTP configuration status |
| `POST` | `/api/notifications/email/send` | Send email to all competition registrants |

## Database

Tables are created and migrated automatically when the server starts with a valid `DATABASE_URL`:

- **`registrations`** — competition signups (unique `ticket_id`)
- **`book_registrations`** — book orders (unique `student_id`)
- **`admins`** — hashed admin credentials

See `src/db/schema.sql` for the full reference schema.

## Security notes

- Never commit `.env`. It is listed in `.gitignore`.
- Change default admin credentials and set a strong `JWT_SECRET` before deploying. The app falls back to a built-in default secret if `JWT_SECRET` is unset — unsafe for production.
- Prefer a Gmail **App Password** (or equivalent) for SMTP rather than your main account password.

## License

Private project for BRACUian Islamic Community / Seerah Summit use.
