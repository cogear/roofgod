# RoofGod Project Progress

**Last Updated**: January 12, 2026

## Project Overview

Building a "siteless" AI SaaS for roofing contractors called **RoofGod**. Primary interface is WhatsApp (no traditional dashboard for end users). Uses AWS Bedrock AgentCore as the AI brain.

## Tech Stack

- **Frontend**: Next.js 16 on Vercel
- **Database**: Supabase (Postgres)
- **Auth**: NextAuth.js (Google OAuth)
- **AI**: AWS Bedrock AgentCore
- **Messaging**: AWS End User Messaging (WhatsApp)
- **Email**: Gmail API (future phase)
- **IaC**: AWS CDK

## Completed Phases

### Phase 1: Foundation ✅
- Next.js 16 project with Turbopack
- Supabase schema (tenants, users, projects, messages, documents, emails)
- Landing page at `/`
- Admin dashboard at `/dashboard` with pages for tenants, conversations, documents, settings
- NextAuth.js with Google OAuth
- Middleware for route protection

### Phase 2: WhatsApp + AgentCore ✅
- AWS CDK infrastructure (`/aws` folder)
- Lambda: `whatsapp-webhook` - receives WhatsApp messages via SNS, invokes Bedrock, sends responses
- Lambda: `agent-actions` - handles Bedrock action groups (ProjectManagement, DocumentManagement)
- OpenAPI schemas for agent actions
- Agent instructions/persona defined
- S3 bucket for documents
- Secrets Manager for credentials
- SNS topic for incoming messages

### Phase 3: Project Management Enhancement ✅
- **Dual-persona logic**: whatsapp-webhook now generates persona instructions based on user role (manager gets detailed responses, crew gets brief actionable responses)
- **Crew invitation flow**: New `pending_invitations` table with invitation codes, expiry, acceptance tracking
- **Context tracking**: Conversations now fetch current project context and pass it to the agent
- **New agent actions**:
  - `updateProject` - Update project status, address, notes, etc.
  - `inviteCrewMember` - Send WhatsApp invitations to new team members
  - `listInvitations` - View pending invitations
  - `setCurrentProject` - Set conversation context to a specific project
- **Database migration**: `003_crew_invitations.sql` with `accept_invitation()` function
- **Updated OpenAPI schemas** for all new actions
- **Enhanced agent instructions** with context awareness documentation

### Phase 4: Email Integration ✅
- **Gmail OAuth flow**: Next.js API routes for `/api/gmail/authorize` and `/api/gmail/callback`
- **Gmail utility library**: Token encryption/decryption, OAuth helpers, Gmail API wrappers
- **Gmail settings UI**: Dashboard component to connect/disconnect Gmail accounts
- **gmail-poller Lambda**: Polls connected accounts every 15 minutes via EventBridge
- **Email classification**: Uses Bedrock Claude Haiku to classify email importance
- **WhatsApp notifications**: Important emails trigger instant WhatsApp alerts to managers
- **EmailIntegration actions**:
  - `listEmails` - Get recent emails
  - `getEmail` - Read full email content
  - `searchEmails` - Search by keyword or project
  - `linkEmailToProject` - Associate emails with projects
- **CDK updates**: Gmail secrets, encryption key, scheduled Lambda
- **OpenAPI schema**: `/aws/schemas/email-integration.yaml`

### Phase 5: Document Intelligence ✅
- **document-processor Lambda**: Processes documents asynchronously via SQS queue
- **Claude Vision integration**: Uses Claude 3 Sonnet for image/PDF analysis via Bedrock
- **Document extraction**: Extracts structured data including:
  - Document type classification (permit, invoice, receipt, photo, insurance_scope, change_order)
  - Addresses, dates, amounts, names, phone numbers
  - Permit/invoice/policy numbers
  - AI-generated summaries
- **WhatsApp media handling**: Photos and documents sent via WhatsApp are automatically queued for processing
- **Auto-filing**: Documents with recognized addresses are auto-linked to matching projects
- **S3 storage**: Documents stored with metadata (tenant, project, document type)
- **WhatsApp confirmations**: Users receive confirmation messages after document processing
- **SQS infrastructure**: Dead letter queue for failed processing, visibility timeout configured
- **DocumentManagement actions**:
  - `searchDocuments` - Search by query, project, or document type
  - `storeDocument` - Store new documents
  - `getDocument` - Get full document details including extracted text and summary
  - `linkDocumentToProject` - Associate documents with projects
  - `listDocumentsByProject` - List all documents for a project
- **CDK updates**: SQS queues, document-processor Lambda with 1024MB memory
- **OpenAPI schema**: Updated `/aws/schemas/document-management.yaml`

### Phase 6: Proactive Features & Admin Polish ✅
- **daily-huddle Lambda**: Morning summary sent to managers via WhatsApp
  - Runs hourly, checks each tenant's timezone for 7 AM delivery
  - Generates personalized summaries using Claude Haiku
  - Includes active projects, projects starting today, important emails, documents processed
  - Respects tenant settings (can be disabled)
- **Admin Dashboard with Live Data**:
  - **Overview page**: Real stats (tenants, users, messages today, documents, active projects)
  - **Usage This Month**: Aggregated WhatsApp messages, documents, emails, AI tokens
  - **Recent Activity feed**: Latest messages across all tenants
  - **Tenants page**: Full tenant list with user/project counts, subscription status
  - **Tenant detail page**: Users, projects, email accounts, settings
  - **Conversations page**: List of all conversations with user info, linked projects
  - **Conversation detail page**: Full message thread with timestamps, processing time
  - **Documents page**: Document browser with type summary, filtering
  - **Document detail page**: AI analysis, extracted text, structured data
  - **Analytics page**: Platform-wide usage stats, per-tenant breakdown, cost estimates
- **Supabase Realtime**: Live updates banner showing new messages/documents in real-time
- **Server actions**: Centralized data fetching in `/src/lib/dashboard/actions.ts`
- **CDK updates**: EventBridge schedule for daily-huddle Lambda (hourly)

## Project Complete

All 6 phases have been implemented. The RoofGod platform is now feature-complete with:
- WhatsApp-first AI assistant for roofing contractors
- Dual-persona responses (detailed for managers, brief for crew)
- Project management via natural language
- Email integration with importance classification
- Document intelligence with Claude Vision
- Proactive daily summaries
- Full admin dashboard with real-time updates

## Key Files

```
/roofgod
├── src/app/(marketing)/page.tsx      # Landing page
├── src/app/(dashboard)/              # Admin dashboard
│   ├── dashboard/page.tsx            # Overview with live stats
│   ├── dashboard/tenants/            # Tenant management
│   ├── dashboard/conversations/      # Conversation browser
│   ├── dashboard/documents/          # Document browser
│   ├── dashboard/analytics/          # Usage analytics
│   └── dashboard/settings/           # Platform settings
├── src/app/api/gmail/                # Gmail OAuth routes
├── src/lib/auth.ts                   # NextAuth config
├── src/lib/supabase/                 # Supabase clients + Realtime hooks
├── src/lib/gmail/                    # Gmail utilities & server actions
├── src/lib/dashboard/actions.ts      # Dashboard server actions
├── src/components/dashboard/         # Dashboard components
│   ├── gmail-settings.tsx
│   └── realtime-banner.tsx           # Live updates indicator
├── supabase/migrations/              # Database schema
│   ├── 001_initial_schema.sql
│   ├── 002_usage_tracking_function.sql
│   └── 003_crew_invitations.sql
├── aws/
│   ├── lib/roofgod-stack.ts          # CDK stack
│   ├── lambda/whatsapp-webhook/      # WhatsApp handler
│   ├── lambda/agent-actions/         # Bedrock actions
│   ├── lambda/gmail-poller/          # Gmail polling Lambda
│   ├── lambda/document-processor/    # Document processing Lambda (Claude Vision)
│   ├── lambda/daily-huddle/          # Morning summary Lambda
│   ├── schemas/                      # OpenAPI for agent
│   │   ├── project-management.yaml
│   │   ├── document-management.yaml
│   │   └── email-integration.yaml
│   └── agent-instructions.md         # Agent persona
└── .env.local.example                # Environment template
```

## Deployment Instructions

1. **Local Development**:
   - Copy `.env.local.example` to `.env.local`
   - Add Supabase and Google OAuth credentials
   - Run `npm run dev`

2. **Deploy AWS Infrastructure**:
   - Run all migrations in `/supabase/migrations/`
   - `cd aws && npm install && cdk deploy`
   - Configure secrets in AWS Secrets Manager:
     - `roofgod/supabase` - Supabase URL and keys
     - `roofgod/whatsapp` - WhatsApp phone_number_id and access_token
     - `roofgod/gmail` - Google OAuth client_id and client_secret
     - `roofgod/encryption-key` - Auto-generated
   - Create Bedrock Agent via AWS Console (use all 3 OpenAPI schemas)
   - Link WhatsApp Business via AWS End User Messaging
   - Add env vars to Vercel: `GOOGLE_GMAIL_CLIENT_ID`, `GOOGLE_GMAIL_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`

3. **Verification Checklist**:
   - [ ] WhatsApp messages flow to the agent and get responses
   - [ ] Documents sent via WhatsApp are processed and indexed
   - [ ] Email polling works and important emails trigger notifications
   - [ ] Daily huddle messages are sent at 7 AM in tenant's timezone
   - [ ] Admin dashboard shows real-time data
   - [ ] Supabase Realtime updates appear in the dashboard

## Plan File

Full implementation plan is at:
`/Users/davidcrowell/.claude/plans/warm-gathering-honey.md`
