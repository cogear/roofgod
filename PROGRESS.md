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

## Not Yet Started

### Phase 3: Project Management Enhancement
- Dual-persona logic refinement
- Crew invitation flow
- Context tracking improvements

### Phase 4: Email Integration
- Gmail OAuth flow in Next.js
- Gmail poller Lambda
- Email notification logic

### Phase 5: Document Intelligence
- Claude Vision for document processing
- Bedrock Knowledge Base setup
- Auto-filing from WhatsApp photos

### Phase 6: Proactive Features
- Daily huddle Lambda
- Admin dashboard real-time updates
- Usage tracking

## Key Files

```
/roofgod
├── src/app/(marketing)/page.tsx      # Landing page
├── src/app/(dashboard)/              # Admin dashboard
├── src/lib/auth.ts                   # NextAuth config
├── src/lib/supabase/                 # Supabase clients
├── supabase/migrations/              # Database schema
├── aws/
│   ├── lib/roofgod-stack.ts          # CDK stack
│   ├── lambda/whatsapp-webhook/      # WhatsApp handler
│   ├── lambda/agent-actions/         # Bedrock actions
│   ├── schemas/                      # OpenAPI for agent
│   └── agent-instructions.md         # Agent persona
└── .env.local.example                # Environment template
```

## To Resume

1. **To test Phase 1**:
   - Copy `.env.local.example` to `.env.local`
   - Add Supabase and Google OAuth credentials
   - Run `npm run dev`

2. **To deploy Phase 2**:
   - `cd aws && npm install && cdk deploy`
   - Configure secrets in AWS Secrets Manager
   - Create Bedrock Agent via AWS Console
   - Link WhatsApp Business via AWS End User Messaging

3. **Next task**: Either deploy & test, or continue to Phase 3 (project management enhancements)

## Plan File

Full implementation plan is at:
`/Users/davidcrowell/.claude/plans/warm-gathering-honey.md`
