# RoofGod AWS Infrastructure

This directory contains the AWS CDK infrastructure and Lambda functions for RoofGod.

## Architecture

```
WhatsApp User
     │
     ▼
AWS End User Messaging (WhatsApp)
     │
     ▼
SNS Topic (roofgod-whatsapp-incoming)
     │
     ▼
Lambda: roofgod-whatsapp-webhook
     │
     ├──► Supabase (user lookup, message storage)
     │
     └──► Bedrock AgentCore
              │
              └──► Lambda: roofgod-agent-actions
                        │
                        ├──► Supabase (CRUD operations)
                        └──► S3 (document storage)
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **AWS CDK** installed: `npm install -g aws-cdk`
3. **Node.js 20+**
4. **Supabase** project created with migrations applied
5. **Meta Business Manager** account with WhatsApp Business API access

## Setup

### 1. Install Dependencies

```bash
cd aws
npm install
```

### 2. Bootstrap CDK (first time only)

```bash
cdk bootstrap
```

### 3. Deploy Stack

```bash
cdk deploy
```

### 4. Configure Secrets

After deployment, update the secrets in AWS Secrets Manager:

**roofgod/supabase:**
```json
{
  "url": "https://your-project.supabase.co",
  "anon_key": "your-anon-key",
  "service_role_key": "your-service-role-key"
}
```

**roofgod/whatsapp:**
```json
{
  "phone_number_id": "your-whatsapp-phone-number-id",
  "access_token": "your-whatsapp-access-token"
}
```

### 5. Create Bedrock Agent

Currently, Bedrock AgentCore must be created via the AWS Console or CLI:

1. Go to **Amazon Bedrock** > **Agents**
2. Click **Create Agent**
3. Configure:
   - **Name**: RoofGod-Assistant
   - **Model**: Claude Sonnet 4 (anthropic.claude-sonnet-4-20250514-v1:0)
   - **Instructions**: Copy from `agent-instructions.md`
4. Add **Action Groups**:
   - **ProjectManagement**: Upload `schemas/project-management.yaml`, select `roofgod-agent-actions` Lambda
   - **DocumentManagement**: Upload `schemas/document-management.yaml`, select same Lambda
5. Create an **Alias** (e.g., "prod")
6. Update the Lambda environment variables:
   - `BEDROCK_AGENT_ID`: The agent ID
   - `BEDROCK_AGENT_ALIAS_ID`: The alias ID

### 6. Configure WhatsApp Webhook

1. Go to **AWS End User Messaging** > **Social**
2. Link your WhatsApp Business Account
3. Configure webhook to publish to SNS topic: `roofgod-whatsapp-incoming`

## Lambda Functions

### roofgod-whatsapp-webhook

Receives WhatsApp messages via SNS, processes them, and sends responses.

**Trigger**: SNS subscription
**Timeout**: 30 seconds
**Memory**: 512 MB

### roofgod-agent-actions

Handles action group requests from Bedrock AgentCore.

**Trigger**: Bedrock AgentCore invocation
**Timeout**: 30 seconds
**Memory**: 512 MB

**Supported Actions**:
- `ProjectManagement/createProject`
- `ProjectManagement/getProject`
- `ProjectManagement/listProjects`
- `ProjectManagement/assignCrewMember`
- `DocumentManagement/searchDocuments`
- `DocumentManagement/storeDocument`

## Development

### Local Testing

Lambda functions can be tested locally using SAM or by invoking with test events:

```bash
# Test agent actions
aws lambda invoke \
  --function-name roofgod-agent-actions \
  --payload file://test-events/create-project.json \
  output.json
```

### Updating Lambda Code

After making changes:

```bash
cdk deploy
```

Or for faster iterations, use direct Lambda updates:

```bash
npm run build
aws lambda update-function-code \
  --function-name roofgod-whatsapp-webhook \
  --zip-file fileb://dist/whatsapp-webhook.zip
```

## Costs

Estimated monthly costs for moderate usage (1000 messages/month):

| Service | Estimated Cost |
|---------|----------------|
| Lambda | $0-5 |
| Bedrock (Claude Sonnet) | $10-50 |
| S3 | $1-5 |
| Secrets Manager | $1 |
| SNS | $0 |
| **Total** | **~$15-60/month** |

WhatsApp messaging costs are separate and charged by Meta.
