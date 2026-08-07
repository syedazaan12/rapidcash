# Hostinger Deployment Guide — RapidCash

This guide explains how to deploy the RapidCash lending platform to Hostinger using the Node.js application manager and connecting it to your Supabase PostgreSQL database.

---

## 1. Prepare Your Supabase Database

1. Ensure your database is initialized on Supabase (e.g. `syedazaan12's Project`).
2. Retrieve your database connection details from **Settings** -> **Database** in the Supabase Dashboard:
   - **Transaction Pooler URL** (Port 6543) or **Direct Connection Host** (Port 5432)
   - Database Password

---

## 2. Package Your Application Files

We have created an automated packaging script to bundle your project while excluding development-only files (like local `node_modules` and database state).

1. In your local development machine, open a terminal in the project root.
2. Run the deployment packager:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\package-deployment.ps1
   ```
3. This creates a clean `rapidcash-deploy.zip` in the project root directory.

---

## 3. Set Up Node.js Application in Hostinger hPanel

1. Log in to your Hostinger **hPanel**.
2. Go to **Websites** -> **Node.js**.
3. Click **Create Application** and configure:
   - **Application URL**: Select the domain or subdomain (e.g. `rapidcash.credit`).
   - **Node.js Version**: Select **Node.js 18 LTS** or **20 LTS**.
   - **Application Path**: Specify the root folder where your files are uploaded.
   - **Entry Point File**: Change this to **`backend/server.js`**.
4. Click **Save** to create the configuration.

---

## 4. Upload Files

1. Go to **Files** -> **File Manager** in hPanel.
2. Navigate to your Node.js application path.
3. Upload `rapidcash-deploy.zip` and **extract** it.
4. Verify that `backend/` and `frontend/` directories are present directly in the application root.

---

## 5. Define Environment Variables

Under the Node.js application manager in hPanel, locate the **Environment Variables** section and add the following variables.

> [!IMPORTANT]
> **Hostinger hPanel Database Connect Wizard:**
> When you use Hostinger's Supabase connect wizard, it may suggest installing `@supabase/supabase-js` and automatically inject `SUPABASE_URL` and `SUPABASE_API_KEY`.
> Since this project is built on **Sequelize** (connecting directly to your Supabase PostgreSQL database via TCP), you should **ignore the wizard's boilerplate code** and manually define the direct database variables (`DB_HOST`, `DB_PASS`, etc.) listed below in your hPanel Node.js dashboard.

| Variable Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Set to the port provided by Hostinger (or leave empty if Hostinger proxy manages it automatically) |
| `JWT_SECRET` | A long, secure random string |
| `JWT_EXPIRES_IN` | `8h` |
| `FIELD_ENCRYPTION_KEY` | A 64-character hex string. Generate one locally using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ALLOWED_ORIGINS` | Comma-separated list of your domain names (e.g. `https://rapidcash.credit,https://www.rapidcash.credit`) |
| `DB_DIALECT` | `mysql` (for Hostinger MySQL) or `postgres` (for Supabase) |
| `DB_HOST` | `localhost` (for Hostinger MySQL) or `db.mxiedqedkzeavxvqnrok.supabase.co` |
| `DB_PORT` | `3306` (for Hostinger MySQL) or `5432` (for Supabase) |
| `DB_NAME` | *Your Hostinger MySQL database name* or `postgres` |
| `DB_USER` | *Your Hostinger MySQL user name* or `postgres` |
| `DB_PASS` | *Your Hostinger MySQL password* or *Supabase password* |
| `DB_SSL` | `false` (for Hostinger MySQL) or `true` (for Supabase) |
| `ADMIN_EMAIL` | The administrator login email (e.g. `admin@rapidcash.credit`) |
| `ADMIN_PASSWORD` | A temporary strong password to access the staff portal |

*Note: Alternatively, you can define a single variable `DATABASE_URL` instead of the `DB_*` variables above.*

---

## 6. Install Dependencies and Build Schema

1. In the hPanel Node.js dashboard, click **NPM Install** or run npm commands via Hostinger SSH terminal.
   - If using SSH, navigate to the application folder and run:
     ```bash
     cd backend
     npm install
     ```
2. Seed the database tables and bootstrap your portal login users:
   - In SSH terminal:
     ```bash
     cd backend
     node scripts/createLogins.js
     ```
   - *Alternative*: Run `npm run seed:logins` from the project root directory, or execute it from the hPanel command interface.

---

## 7. Verification

1. Access your domain (e.g., `https://rapidcash.credit/`).
2. Go to `https://rapidcash.credit/login.html` and log in with your seeded administrative credentials.
3. Verify that the dashboard loads the underwriting staff portal stats.
4. Make sure **SSL (HTTPS)** is enabled on Hostinger for security.
