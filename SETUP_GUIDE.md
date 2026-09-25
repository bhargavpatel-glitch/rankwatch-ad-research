# Rankwatch Ad Intelligence: Production Deployment & Shared Database Setup Guide

This guide details the exact steps to enable remote shared database synchronization across 3–4 teammates (at ₹0 / month on Netlify Free + Supabase Free).

---

## 1. Supabase Free Setup (Shared PostgreSQL Database)

1. Sign up / Log in to [Supabase](https://supabase.com).
2. Click **New Project**:
   - **Name**: `rankwatch-ad-intel`
   - **Database Password**: Set a secure password.
   - **Pricing Plan**: Free (₹0 / month).
3. Once created, click on the **SQL Editor** in the left sidebar.
4. Open the SQL file: `supabase/migrations/20260925_init_sync_schema.sql` located in this repository.
5. Copy the entire contents, paste into the Supabase SQL Editor, and click **Run**.
   - This creates tables: `workspaces`, `profiles`, `workspace_members`, `sheet_sources`, `sheet_tabs`, `ads`, `ad_sources`, `sync_jobs`, `sync_errors` + Row Level Security (RLS) policies and performance indexes.
6. In Supabase, go to **Project Settings -> API**:
   - Copy **Project URL** (e.g., `https://xyzabcdef.supabase.co`).
   - Copy **anon / public key** (under Project API keys).
   - Copy **service_role key** (secret key used by Netlify Functions backend).

---

## 2. Google Sheets Configuration

1. Open the Google Spreadsheet you want to connect.
2. Click **Share** (top-right).
3. Set General Access to **"Anyone with the link can view"** (Viewer).
4. *(Optional Google Sheets API v4)*: If you want to use official Google Sheets v4 API quotas instead of public export, obtain a free Google Cloud API key and copy it.

---

## 3. Netlify Environment Variables Configuration

In your Netlify Dashboard for your site (`https://funny-brioche-f5f996.netlify.app`):
1. Navigate to: **Site configuration -> Environment variables**.
2. Add the following environment variables:

| Variable Name | Value Description | Visibility / Scope |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) | Frontend & Functions |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon Public Key | Frontend & Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Secret Service Role Key | Netlify Functions Only |
| `GOOGLE_API_KEY` | *(Optional)* Google Cloud API Key for Google Sheets v4 | Netlify Functions Only |

3. Trigger a redeploy:
   - Go to **Deploys -> Trigger deploy -> Clear cache and deploy site**.

---

## 4. Multi-Teammate Verification Workflow

Once deployed with the environment variables set:

1. **Laptop 1 (Teammate A)**:
   - Opens the live Netlify website.
   - The sidebar displays: `🟢 Shared Supabase DB`.
   - Clicks **Data Sources** -> **Add Google Sheet** -> enters Google Sheets URL.
   - Discovers tabs -> selects tabs to import -> saves source.
   - Clicks **Sync Now** -> Watches live batch import.
   - Real summary report modal displays exact inserted/updated counts.

2. **Laptop 2 & 3 (Teammates B & C)**:
   - Opens the live Netlify website from their laptops.
   - Immediately sees the exact same updated ad library, configured sources, and latest sync history queried in real-time from Supabase.
