# PostgreSQL Migration Guide

## Overview

This guide helps you set up PostgreSQL for production deployment.

---

## Prerequisites

- PostgreSQL 14+ installed (locally or cloud service)
- Access to create databases

---

## Cloud PostgreSQL Options

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| [Supabase](https://supabase.com) | ✅ 500MB | Recommended, easy setup |
| [Neon](https://neon.tech) | ✅ 512MB | Serverless, auto-scaling |
| [Railway](https://railway.app) | ✅ $5 credit | Simple, integrated |
| [Render](https://render.com) | ✅ 90 days | Good for testing |
| [ElephantSQL](https://elephantsql.com) | ✅ 20MB | Very limited |
| AWS RDS | ❌ Paid | Enterprise |
| Google Cloud SQL | ❌ Paid | Enterprise |

---

## Step 1: Create PostgreSQL Database

### Option A: Local PostgreSQL
```bash
# Create database
createdb kewhats

# Or via psql
psql -U postgres
CREATE DATABASE kewhats;
```

### Option B: Supabase (Recommended for Free)
1. Go to https://supabase.com
2. Create new project
3. Copy the connection string from Settings > Database > Connection string (URI)

---

## Step 2: Update Environment Variables

Edit your `.env` file:

```env
# PostgreSQL Connection String
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Example for Supabase:
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres?schema=public"

# Example for local:
DATABASE_URL="postgresql://postgres:password@localhost:5432/kewhats?schema=public"
```

---

## Step 3: Generate Prisma Client

```bash
cd server
npx prisma generate
```

---

## Step 4: Run Migrations

### For Fresh Database (No existing data)
```bash
npx prisma migrate deploy
```

### For Development (Creates migration files)
```bash
npx prisma migrate dev --name init
```

---

## Step 5: Verify Connection

```bash
npx prisma db pull
```

If successful, your database is connected!

---

## Migrating Data from SQLite

If you have existing data in SQLite that you want to migrate:

### Option 1: Export/Import via JSON
```bash
# Export from SQLite
npx prisma db execute --file export.sql

# Or use a tool like pgloader
```

### Option 2: Fresh Start (Recommended)
1. Deploy with empty PostgreSQL
2. Create new admin user
3. Let users re-register

---

## Troubleshooting

### Error: Connection refused
- Check if PostgreSQL is running
- Verify host, port, and credentials
- Check firewall rules

### Error: Database does not exist
```bash
createdb kewhats
```

### Error: SSL required
Add `?sslmode=require` to connection string:
```env
DATABASE_URL="postgresql://...?schema=public&sslmode=require"
```

---

## Production Checklist

- [ ] PostgreSQL 14+ installed
- [ ] Database created
- [ ] Connection string in `.env`
- [ ] `npx prisma generate` run
- [ ] `npx prisma migrate deploy` run
- [ ] Application starts without errors

---

## Performance Tips

1. **Enable connection pooling** (PgBouncer or built-in Supabase pooler)
2. **Set appropriate pool size** in Prisma:
   ```env
   DATABASE_URL="postgresql://...?connection_limit=10"
   ```
3. **Use read replicas** for high-traffic apps
4. **Enable query logging** temporarily to find slow queries

---

## Rollback to SQLite (Development Only)

If you need to switch back to SQLite for development:

1. Edit `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `.env`:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

3. Regenerate client:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
