# RoofGod System Architecture

A comprehensive guide to how RoofGod works - a "siteless" AI SaaS platform for roofing contractors where the primary user interface is WhatsApp.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Concept: Siteless SaaS](#core-concept-siteless-saas)
4. [Component Deep Dive](#component-deep-dive)
5. [Data Flow](#data-flow)
6. [User Journeys](#user-journeys)
7. [AI Agent System](#ai-agent-system)
8. [Security Model](#security-model)

---

## Overview

RoofGod is an AI-powered business assistant for roofing contractors. Unlike traditional SaaS applications with web dashboards, RoofGod's primary interface is **WhatsApp**. Contractors interact with an AI assistant via text messages to manage projects, process documents, and stay organized.

### Key Principles

1. **WhatsApp-First**: All end-user interaction happens via WhatsApp. No app to download, no website to learn.
2. **AI-Native**: AWS Bedrock AgentCore powers natural language understanding and tool execution.
3. **Dual-Persona**: The AI adapts its communication style based on user role (manager vs. crew).
4. **Document Intelligence**: Photos and files sent via WhatsApp are automatically processed, classified, and indexed.
5. **Proactive**: The system sends morning huddles and email alerts without being asked.

---

## Architecture Diagram

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                         VERCEL                               │
                                    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
                                    │  │  Landing    │  │   Admin     │  │   OAuth Flows       │  │
                                    │  │  Page       │  │  Dashboard  │  │  (Gmail, NextAuth)  │  │
                                    │  └─────────────┘  └──────┬──────┘  └──────────┬──────────┘  │
                                    │                          │                     │            │
                                    │  ┌───────────────────────┴─────────────────────┘            │
                                    │  │  Server Functions (Dashboard Data)                       │
                                    └──┼──────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        SUPABASE                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL + Row Level Security                                                           │  │
│  │  tenants | users | projects | messages | documents | emails | email_accounts              │  │
│  │  conversations | pending_invitations | usage_tracking                                      │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
│  Realtime (Live dashboard updates)                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                       ▲
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────────────────────────┐
│                                      │        AWS                                               │
│  ┌───────────────────────────────────┴───────────────────────────────────────────────────────┐  │
│  │                              LAMBDA FUNCTIONS                                              │  │
│  │                                                                                            │  │
│  │  whatsapp-webhook    gmail-poller      document-processor    daily-huddle                 │  │
│  │  (SNS trigger)       (EventBridge)     (SQS trigger)         (EventBridge)                │  │
│  │       │                    │                  │                    │                       │  │
│  │       └────────────────────┴──────────────────┴────────────────────┘                       │  │
│  │                                       │                                                    │  │
│  │                                       ▼                                                    │  │
│  │                            agent-actions Lambda                                            │  │
│  │                      (Bedrock AgentCore Tool Handler)                                      │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                                      │
│                                          ▼                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         AWS BEDROCK AGENTCORE                                             │  │
│  │                                                                                            │  │
│  │  Agent: "RoofGod Assistant"                                                               │  │
│  │  ├── System Prompt (persona, context awareness)                                           │  │
│  │  ├── Session Memory (conversation history)                                                │  │
│  │  └── Action Groups:                                                                       │  │
│  │      ├── ProjectManagement (CRUD, crew, context)                                          │  │
│  │      ├── DocumentManagement (search, store, link)                                         │  │
│  │      └── EmailIntegration (list, search, link)                                            │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                 │
│  Other AWS Services:                                                                            │
│  ├── SNS Topic (WhatsApp incoming messages)                                                    │
│  ├── SQS Queue (document processing)                                                          │
│  ├── S3 Bucket (document storage)                                                             │
│  ├── Secrets Manager (credentials)                                                            │
│  └── End User Messaging (WhatsApp Business API)                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
            WhatsApp Users
         (Managers & Crews)
```

---

## Core Concept: Siteless SaaS

### What "Siteless" Means

Traditional SaaS requires users to:
1. Create an account on a website
2. Learn a new interface
3. Navigate dashboards and forms
4. Switch between their work and the software

RoofGod eliminates all of this. Users interact via WhatsApp, which they already use daily. The AI understands natural language, so there's no interface to learn.

### How It Works in Practice

**Traditional SaaS:**
```
User → Opens browser → Logs in → Navigates to Projects → Clicks "New" → Fills form → Saves
```

**RoofGod:**
```
User → Sends WhatsApp message: "Create a new job at 123 Oak St for Mrs. Johnson"
AI → Creates project, responds: "Got it! Created project '123 Oak St' for Mrs. Johnson"
```

### The Admin Dashboard Exception

While end-users (contractors, crew) only use WhatsApp, there IS a web dashboard for:
- Platform administrators (the SaaS operator)
- Viewing all tenants and their usage
- Monitoring conversations across the platform
- Browsing processed documents
- Analytics and cost tracking

This dashboard is at `/dashboard` and requires admin authentication.

---

## Component Deep Dive

### 1. WhatsApp Webhook Lambda (`whatsapp-webhook`)

**Trigger:** SNS Topic (messages from AWS End User Messaging)

**Purpose:** The entry point for all WhatsApp messages

**Flow:**
```
1. Receive SNS event with WhatsApp message payload
2. Parse message (text, image, document, audio)
3. Look up user by phone number in Supabase
4. Get or create conversation record
5. Store inbound message
6. Fetch conversation context (current project, user role)
7. Build persona instruction based on user role
8. Invoke Bedrock AgentCore with context
9. Send AI response via WhatsApp API
10. Store outbound message
11. If media received, queue for document processing
12. Update usage tracking
```

**Dual-Persona Logic:**
```typescript
function getPersonaInstruction(userRole: string, isNewUser: boolean): string {
  if (isNewUser) {
    return "PERSONA: This is a NEW USER. Welcome them warmly...";
  }
  switch (userRole) {
    case "manager":
    case "owner":
      return "PERSONA: This user is a MANAGER. Provide detailed responses...";
    case "crew":
      return "PERSONA: This user is a CREW MEMBER. Keep responses BRIEF...";
  }
}
```

### 2. Agent Actions Lambda (`agent-actions`)

**Trigger:** Bedrock AgentCore (when the AI decides to use a tool)

**Purpose:** Executes database operations requested by the AI

**Action Groups:**

| Group | Actions | Purpose |
|-------|---------|---------|
| ProjectManagement | createProject, updateProject, listProjects, getProjectDetails, assignCrewMember, inviteCrewMember, listInvitations, setCurrentProject | Project CRUD and crew management |
| DocumentManagement | searchDocuments, storeDocument, getDocument, linkDocumentToProject, listDocumentsByProject | Document indexing and retrieval |
| EmailIntegration | listEmails, getEmail, searchEmails, linkEmailToProject | Email access and organization |

**Example Flow (Create Project):**
```
User: "Create a project called Oak St Reroof at 456 Oak Street"
      ↓
Bedrock Agent: Decides to call createProject tool
      ↓
Agent Actions Lambda:
  - Parses parameters (name, address)
  - Inserts into projects table
  - Returns success response
      ↓
Bedrock Agent: Generates natural language response
      ↓
User receives: "Done! I've created 'Oak St Reroof' at 456 Oak Street"
```

### 3. Document Processor Lambda (`document-processor`)

**Trigger:** SQS Queue (messages from WhatsApp webhook or email poller)

**Purpose:** AI-powered document analysis using Claude Vision

**Flow:**
```
1. Receive SQS message with media info
2. Download media (from WhatsApp API or S3)
3. Send to Claude Vision via Bedrock:
   - Classify document type (permit, invoice, receipt, photo, etc.)
   - Extract text content
   - Extract structured data (addresses, dates, amounts, names)
   - Generate summary
4. Determine project association (by address matching)
5. Upload to S3 with organized path
6. Store metadata in Supabase documents table
7. Send WhatsApp confirmation to user
8. Update usage tracking
```

**Document Classification:**
```
permit          → Building permits, inspection reports
invoice         → Bills, payment requests
receipt         → Proof of payment
photo           → Job site photos
insurance_scope → Insurance claim documents
change_order    → Contract modifications
```

### 4. Gmail Poller Lambda (`gmail-poller`)

**Trigger:** EventBridge (every 15 minutes)

**Purpose:** Check connected email accounts for new messages

**Flow:**
```
1. Get all active email accounts from Supabase
2. For each account:
   a. Decrypt OAuth tokens
   b. Refresh tokens if expired
   c. Fetch new emails since last sync
   d. For each email:
      - Store in emails table
      - Classify importance with Claude Haiku
      - If important: send WhatsApp notification to manager
   e. Update last_sync_at timestamp
3. Update usage tracking
```

**Importance Classification Prompt:**
```
You are classifying emails for a roofing contractor.
Rate importance 1-5:
5 = Urgent (insurance claim, permit issue, angry customer)
4 = Important (new lead, payment, inspection scheduled)
3 = Normal (supplier quote, routine update)
2 = Low (newsletter, marketing)
1 = Skip (spam, irrelevant)
```

### 5. Daily Huddle Lambda (`daily-huddle`)

**Trigger:** EventBridge (every hour)

**Purpose:** Send morning summaries to managers

**Flow:**
```
1. Get all active tenants
2. For each tenant:
   a. Check if current hour is 7 AM in tenant's timezone
   b. Skip if huddle is disabled in settings
   c. Gather summary data:
      - Active project count
      - Projects starting today
      - Unread important emails
      - Documents processed yesterday
      - Pending crew invitations
   d. Generate summary message with Claude Haiku
   e. Send to all managers via WhatsApp
3. Log messages and update usage
```

**Example Huddle Message:**
```
Good morning! Here's your daily huddle:
- 5 active projects
- Starting today: Oak St Reroof
- 2 important emails need attention
- 3 documents processed yesterday
Have a great day!
```

---

## Data Flow

### Message Flow (WhatsApp → AI → Response)

```
┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌──────────────┐
│ WhatsApp │────▶│ AWS End User│────▶│   SNS   │────▶│   Lambda:    │
│   User   │     │  Messaging  │     │  Topic  │     │   webhook    │
└──────────┘     └─────────────┘     └─────────┘     └──────┬───────┘
                                                            │
                    ┌───────────────────────────────────────┘
                    ▼
            ┌───────────────┐
            │   Supabase    │  ← Look up user, conversation
            │   (Postgres)  │  ← Store inbound message
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │   Bedrock     │  ← Send message + context
            │   AgentCore   │  ← Get AI response
            └───────┬───────┘
                    │
                    ▼ (if tool needed)
            ┌───────────────┐
            │   Lambda:     │  ← Execute database operation
            │ agent-actions │  ← Return result to agent
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │   Supabase    │  ← Store outbound message
            │   (Postgres)  │  ← Update usage tracking
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐     ┌──────────┐
            │ WhatsApp API  │────▶│ WhatsApp │
            │   (Graph)     │     │   User   │
            └───────────────┘     └──────────┘
```

### Document Flow (Photo → Processed Document)

```
┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌──────────────┐
│ WhatsApp │────▶│   Lambda:   │────▶│   SQS   │────▶│   Lambda:    │
│  (Photo) │     │   webhook   │     │  Queue  │     │  doc-proc    │
└──────────┘     └─────────────┘     └─────────┘     └──────┬───────┘
                                                            │
                    ┌───────────────────────────────────────┘
                    ▼
            ┌───────────────┐
            │  WhatsApp API │  ← Download media
            │   (Graph)     │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │   Bedrock     │  ← Send image to Claude Vision
            │ Claude Vision │  ← Get classification + extraction
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐     ┌───────────────┐
            │      S3       │     │   Supabase    │
            │    Bucket     │     │  documents    │
            └───────────────┘     └───────┬───────┘
                                          │
                                          ▼
                                  ┌───────────────┐
                                  │  WhatsApp     │  ← "Document processed!"
                                  │  Confirmation │
                                  └───────────────┘
```

---

## User Journeys

### Journey 1: New User Onboarding

```
1. Manager signs up (Stripe checkout, future phase)
2. Manager receives WhatsApp link
3. Manager sends first message: "Hi"
4. AI detects new user, welcomes them:
   "Welcome to RoofGod! I'm your AI assistant. Let's get you set up.
    What's the name of your roofing company?"
5. Manager: "Smith Roofing LLC"
6. AI creates tenant, asks about first project
7. Manager: "We're starting a job at 123 Main St tomorrow"
8. AI creates project, offers to add crew
9. Manager: "Add my foreman Joe at 555-123-4567"
10. AI sends invitation to Joe via WhatsApp
11. Joe receives: "Hi! You've been invited to join Smith Roofing on RoofGod..."
12. Joe accepts, gets brief instructions
```

### Journey 2: Daily Crew Workflow

```
Morning:
1. Crew member receives daily huddle (if manager enabled)
2. Or crew asks: "What's my job today?"
3. AI responds: "You're on the Oak St job. Address: 123 Oak St.
   Yesterday the crew completed tear-off. Today: underlayment."

During work:
4. Crew takes photo of completed work
5. Sends via WhatsApp with caption: "underlayment done"
6. AI: "Got it! Filed photo to Oak St project."

Issue arises:
7. Crew: "Found some rotted decking, need to replace about 20 sq ft"
8. AI: "I'll let the manager know. Should I create a change order note?"
9. Crew: "Yes"
10. AI logs it, notifies manager via WhatsApp
```

### Journey 3: Document Processing

```
1. Contractor receives permit email with PDF attachment
2. Gmail poller detects new email, classifies as "important"
3. Manager gets WhatsApp: "New important email: Building Permit Approved - Oak St"
4. Manager forwards the PDF to RoofGod WhatsApp
5. Document processor analyzes:
   - Type: permit
   - Address: 123 Oak Street
   - Permit #: BP-2026-12345
   - Issued: January 12, 2026
6. Auto-links to Oak St project
7. Manager gets: "Permit filed to Oak St project. Permit #BP-2026-12345"
8. Later, manager asks: "Do we have the permit for Oak St?"
9. AI: "Yes, permit #BP-2026-12345 issued January 12, 2026."
```

---

## AI Agent System

### Bedrock AgentCore Configuration

The AI agent is configured in AWS Bedrock with:

**System Prompt (Agent Instructions):**
```
You are RoofGod, an AI assistant for roofing contractors.
You help manage projects, organize documents, and keep crews informed.

PERSONA ADAPTATION:
- Check sessionAttributes.personaInstruction for user role
- Managers: Detailed responses, proactive suggestions, financial info
- Crew: Brief, actionable, one-line when possible

CONTEXT AWARENESS:
- sessionAttributes.currentProject contains active project context
- Reference it naturally: "On your current project at Oak St..."

TOOL USAGE:
- Use tools to fetch/modify data, never make up information
- If user asks about a project, use getProjectDetails first
- If user sends a document, it's already being processed

COMMUNICATION STYLE:
- Friendly but professional
- No jargon unless user uses it first
- Confirm actions taken
- Offer next steps when appropriate
```

**Action Groups:**
Three OpenAPI schemas define the tools the agent can use:
- `project-management.yaml` - Project and crew operations
- `document-management.yaml` - Document search and storage
- `email-integration.yaml` - Email access

**Session State:**
Each conversation includes:
```json
{
  "sessionAttributes": {
    "userContext": {
      "phone_number": "+15551234567",
      "user_id": "uuid",
      "user_name": "John",
      "user_role": "manager",
      "tenant_id": "uuid",
      "is_new_user": false
    },
    "personaInstruction": "PERSONA: This user is a MANAGER...",
    "currentProject": {
      "project_id": "uuid",
      "project_name": "Oak St Reroof",
      "address": "123 Oak Street",
      "status": "active"
    }
  }
}
```

### Model Selection

| Use Case | Model | Why |
|----------|-------|-----|
| Conversational AI | Claude 3 Sonnet | Balance of capability and cost |
| Document Vision | Claude 3 Sonnet | Vision capabilities |
| Email Classification | Claude 3 Haiku | Fast, cheap, simple task |
| Huddle Generation | Claude 3 Haiku | Fast, cheap, simple task |

---

## Security Model

### Multi-Tenancy

All data is isolated by `tenant_id`:
- Every table has a `tenant_id` column
- Supabase Row Level Security (RLS) enforces isolation
- Lambda functions always filter by tenant_id

### Authentication

| Component | Method |
|-----------|--------|
| WhatsApp Users | Phone number lookup in users table |
| Admin Dashboard | NextAuth.js with Google OAuth |
| Gmail OAuth | OAuth 2.0 with encrypted token storage |
| AWS Services | IAM roles with least privilege |

### Secrets Management

All sensitive data stored in AWS Secrets Manager:
- `roofgod/supabase` - Database credentials
- `roofgod/whatsapp` - WhatsApp API tokens
- `roofgod/gmail` - Google OAuth client credentials
- `roofgod/encryption-key` - AES key for token encryption

### Token Encryption

Gmail OAuth tokens are encrypted at rest:
```typescript
// Encryption: AES-256-GCM
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(token), cipher.final()]);
// Store: iv + authTag + encrypted (base64)
```

---

## Database Schema Summary

```
tenants
├── id, name, stripe_customer_id, subscription_status
├── whatsapp_business_number, timezone, settings

users
├── id, tenant_id, phone_number, name, email
├── role (owner/manager/crew), is_active, last_seen_at

projects
├── id, tenant_id, name, address, customer_name
├── status, start_date, notes, metadata

project_members
├── project_id, user_id, role

conversations
├── id, tenant_id, user_id, current_project_id
├── context (JSONB), last_message_at

messages
├── id, conversation_id, tenant_id, direction
├── message_type, content, whatsapp_message_id
├── processing_time_ms, agent_model

documents
├── id, tenant_id, project_id, document_type
├── filename, s3_key, s3_bucket, extracted_text
├── metadata (JSONB: summary, structured_data, confidence)

emails
├── id, tenant_id, email_account_id, provider_message_id
├── subject, from_address, body_text, summary
├── is_important, linked_project_id

email_accounts
├── id, tenant_id, provider, email_address
├── access_token_encrypted, refresh_token_encrypted
├── is_active, last_sync_at

pending_invitations
├── id, tenant_id, phone_number, name, role
├── invited_by, invitation_code, status, expires_at

usage_tracking
├── tenant_id, month, whatsapp_messages_received/sent
├── documents_processed, emails_processed
├── bedrock_input_tokens, bedrock_output_tokens
```

---

## Deployment Checklist

### Prerequisites
- [ ] AWS Account with Bedrock access
- [ ] Supabase project
- [ ] Meta Business account with WhatsApp Business API
- [ ] Google Cloud project for Gmail OAuth
- [ ] Vercel account

### AWS Setup
- [ ] Run `cd aws && npm install && cdk deploy`
- [ ] Configure Secrets Manager values
- [ ] Create Bedrock Agent with OpenAPI schemas
- [ ] Link WhatsApp via End User Messaging
- [ ] Verify EventBridge schedules active

### Supabase Setup
- [ ] Run all migrations in order
- [ ] Enable Realtime for messages, documents, conversations
- [ ] Configure RLS policies

### Vercel Setup
- [ ] Deploy Next.js app
- [ ] Set environment variables
- [ ] Configure custom domain

### Testing
- [ ] Send WhatsApp message, verify response
- [ ] Send photo, verify document processing
- [ ] Connect Gmail, verify email polling
- [ ] Wait for 7 AM, verify daily huddle
- [ ] Check admin dashboard shows data
