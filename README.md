<div align="center">

# BIZORA

### Your Business. In Clear View.

**An all-in-one business operations and cash-flow workspace for freelance photographers.**

![React](https://img.shields.io/badge/React-18-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Status](https://img.shields.io/badge/Status-In%20Development-8B7CC7?style=flat-square)

**[Live Demo](YOUR_BIZORA_LIVE_URL)** · **[GitHub Profile](https://github.com/mulasaikarthik)** · **[LinkedIn — Sai Karthik](YOUR_SAI_KARTHIK_LINKEDIN_URL)** · **[LinkedIn — Priya Varshini](YOUR_PRIYA_VARSHINI_LINKEDIN_URL)**

**Team DuoNex** · ACE Builders Hackathon 2026

</div>

---

## Overview

**Bizora** is a business management web application built around the everyday needs of independent photographers and small creative studios. It brings clients, invoices, payments, expenses, and cash-flow planning into one organized workspace—so business owners can spend less time chasing information and more time serving clients.

> **The idea:** A photographer shouldn't need five different tools to answer two simple questions: *Who owes me money?* and *Will I have enough cash for my upcoming bills?*

## The Problem

Freelance photographers often manage their work through a mix of messages, notebooks, and spreadsheets. As bookings grow, they can lose visibility into:

- Which clients have outstanding balances
- Which invoices are overdue and need follow-up
- How much money has actually been received
- When equipment rentals, travel, editing, and other bills are due
- Whether expected payments will cover expenses over the next 30–90 days

## The Solution

Bizora connects the essential back-office workflow in a single application:

**Client → Invoice → Payment → Outstanding Balance → Cash Forecast → Next Action**

### Core Modules

| Module | What it does |
| --- | --- |
| **Dashboard** | Displays key financial metrics, overdue invoices, recent activity, and upcoming work. |
| **Clients** | Organizes customer details and associated invoice balances. |
| **Invoices** | Manages invoice items, taxes, due dates, and payment status. |
| **Payments** | Tracks full and partial payments against invoices. |
| **Expenses** | Organizes paid expenses and upcoming business bills. |
| **Cash Forecast** | Models 30-, 60-, and 90-day cash flow, including late-payment scenarios. |
| **Settings** | Manages business information, currency, and invoicing preferences. |

## Why Cash-Flow Forecasting Matters

Suppose a photographer starts with **₹45,000** in cash, expects **₹30,000** from clients, and must pay **₹60,000** in bills.

| Scenario | Projected balance |
| --- | ---: |
| Payments arrive as planned | **₹15,000** |
| ₹20,000 is delayed beyond the relevant bill date | **−₹5,000** |

This fictional example illustrates how a late payment can create a temporary shortfall even when the business has invoices awaiting collection. Bizora's forecasting module is designed to make these risks visible early.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Routing | React Router |
| Data visualization | Recharts |
| Backend prototype | Node.js HTTP API |
| Prototype persistence | JSON-file storage |
| Planned database integration | Supabase PostgreSQL |
| Planned authentication integration | Supabase Auth |
| Development environment | Codebenders Nexen IDE |

**Implementation note:** The local Node.js API has been tested, but end-to-end frontend integration and the Supabase migration should be verified before describing them as complete.

## Local Development

### Requirements

- Node.js and npm
- Git

### 1. Clone the project

```bash
git clone YOUR_BIZORA_REPOSITORY_URL
cd Bizora
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the frontend

```bash
npm run dev
```

Vite is configured to use **http://localhost:5173**.

### 4. Start the backend prototype

In a separate terminal:

```bash
node server/index.mjs
```

The API defaults to **http://localhost:4000**. For example, the state endpoint is available at `http://localhost:4000/api/state` when the server is running.

> Running the two services does not automatically establish frontend-to-backend integration. Verify API configuration before expecting the dashboard to read persistent server data.

### 5. Build the frontend

```bash
npm run build
```

## Verification Status

The following results were confirmed during local development:

- **Frontend:** Vite production build completed successfully.
- **Backend:** API responded to a request for sample business data.
- **Automated checks:** 18 backend tests passed, including payment validation, invoice state calculations, and late-payment forecasting.

**Still to verify or complete:** End-to-end frontend/API integration, secure authentication, Supabase database persistence, deployment, and production readiness.

## Product Direction

Bizora begins with freelance photographers and small creative studios. Potential next steps include:

- Automated, customizable payment reminders
- Branded PDF invoices and sharing
- Secure multi-user studio access
- Improved reporting and cash-flow insights
- Online payment integrations

A subscription model for independent professionals and small studios is a **proposed** business direction, not a claim of existing paying customers.

## Team DuoNex

| Team member | Role |
| --- | --- |
| **Sai Karthik** | Team Member |
| **Priya Varshini** | Team Member |

Created as a project for the **Codebenders ACE Builders Hackathon 2026**.

## Links

- **Live application:** [Bizora](YOUR_BIZORA_LIVE_URL)
- **GitHub:** [Sai Karthik](https://github.com/mulasaikarthik)
- **LinkedIn:** [Sai Karthik](YOUR_SAI_KARTHIK_LINKEDIN_URL) · [Priya Varshini](YOUR_PRIYA_VARSHINI_LINKEDIN_URL)

---

<div align="center">

**Bizora — Less admin. Clearer finances. More room to create.**

Made by **Team DuoNex** · Sai Karthik & Priya Varshini

</div>
