# BRACUian Seerah Summit

Registration and event portal for **BRACUian Seerah Summit 1448**, organized by the [BRACUian Islamic Community (BUIC)](https://www.facebook.com/BRACUianIslamicCommunity/). Students can register for the Seerah competition, order the book *উসওয়াতুন হাসানাহ*, and explore quiz / open-book / seminar event pages. Admins manage participants, book orders, and email notifications.

## Features

- **Competition registration** — online signup with ticket ID, student details, and bKash payment reference
- **Book registration** — purchase / pickup flow for *উসওয়াতুন হাসানাহ*, with participant lookup and public bKash number
- **Event pages** — Seerah Quiz Competition, Open Book Competition, and Grand Seerah Seminar
- **Admin dashboard** — JWT-protected panel to view, edit, delete registrations; manage book orders; export CSV; send bulk email
- **Neon PostgreSQL** — schema and indexes created automatically on startup
- **Optional SMTP** — bulk notifications to registered participants

## Tech stack

| Layer | Stack |
|--------|--------|
| Runtime | Node.js (CommonJS) |
| Server | Express |
| Database | PostgreSQL via [Neon](https://neon.tech) (`pg`) |
| Auth | JWT cookies + bcrypt password hashing |
| Email | Nodemailer (SMTP) |
| Frontend | Static HTML / CSS / JS with server-injected header & footer partials |

## Project structure

```
seerah-summit/
├── server.js                 # App entry — Express bootstrap + DB init
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
│   └── views/                # Static pages, CSS, JS, images, partials
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

   \*Without a valid `DATABASE_URL`, the app still boots but runs in a local fallback mode with no DB.

   On first successful DB connect, if the `admins` table is empty, a default admin is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

3. **Run**

   ```bash
   npm start          # production
   npm run dev        # auto-restart on file changes (node --watch)
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Pages

| Path | Description |
|------|-------------|
| `/` | Home — summit intro & events |
| `/about` | About BUIC / the summit |
| `/contact` | Contact |
| `/register` | Competition registration |
| `/book-register` | Book purchase registration |
| `/events/quiz` | Seerah Quiz Competition details |
| `/events/open-book` | Open Book Competition details |
| `/events/grand-seminar` | Grand Seerah Seminar details |
| `/login` | Admin login |
| `/admin` | Admin dashboard (auth required) |

## API overview

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health / DB status |
| `POST` | `/api/register` | Submit competition registration |
| `GET` | `/api/book-register/config` | Public book config (e.g. bKash number) |
| `POST` | `/api/book-register/lookup` | Look up participant by student ID |
| `POST` | `/api/book-register` | Submit book order |

### Admin auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Log in |
| `POST` | `/api/admin/logout` | Log out |
| `GET` | `/api/admin/me` | Current admin session |

### Admin (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/participants` | List registrations |
| `PUT` | `/api/participants/:id` | Update a registration |
| `DELETE` | `/api/participants/:id` | Delete a registration |
| `GET` | `/api/book-orders` | List book orders |
| `DELETE` | `/api/book-orders/:id` | Delete a book order |
| `GET` | `/api/notifications/email/status` | SMTP configuration status |
| `POST` | `/api/notifications/email/send` | Send email to all participants |

## Database

Tables are created and migrated automatically when the server starts with a valid `DATABASE_URL`:

- **`registrations`** — competition signups (unique `ticket_id`)
- **`book_registrations`** — book orders (unique `student_id`)
- **`admins`** — hashed admin credentials

See `src/db/schema.sql` for the full reference schema.

## Security notes

- Never commit `.env`. It is listed in `.gitignore`.
- Change default admin credentials and set a strong `JWT_SECRET` before deploying.
- Prefer a Gmail **App Password** (or equivalent) for SMTP rather than your main account password.

## License

Private project for BRACUian Islamic Community / Seerah Summit use.
