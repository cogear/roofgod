-- RoofGod Initial Schema
-- Multi-tenant SaaS for roofing contractors

-- TENANTS: Roofing companies
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'trialing',
    subscription_plan TEXT DEFAULT 'starter',
    whatsapp_business_number TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USERS: People within tenants (managers, crew)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    name TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'crew', -- manager, crew, owner
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone_number)
);

-- Index for fast phone lookup (critical for WhatsApp webhook)
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- PROJECTS: Roofing jobs
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    status TEXT DEFAULT 'active', -- lead, scheduled, active, completed, on_hold
    start_date DATE,
    estimated_completion DATE,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_status ON projects(tenant_id, status);

-- PROJECT_MEMBERS: Crew assigned to projects
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'crew', -- lead, crew
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- CONVERSATIONS: WhatsApp conversation threads
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    whatsapp_thread_id TEXT,
    current_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    context JSONB DEFAULT '{}',
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);

-- MESSAGES: Individual messages in conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    direction TEXT NOT NULL, -- inbound, outbound
    message_type TEXT NOT NULL, -- text, image, audio, document, template
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    whatsapp_message_id TEXT,
    agent_model TEXT,
    agent_session_id TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_tenant ON messages(tenant_id, created_at DESC);

-- DOCUMENTS: Files stored in S3
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    document_type TEXT, -- permit, invoice, receipt, photo, insurance_scope, change_order
    filename TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_bucket TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    source TEXT, -- whatsapp, email, upload
    source_message_id UUID REFERENCES messages(id),
    extracted_text TEXT,
    metadata JSONB DEFAULT '{}',
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_type ON documents(tenant_id, document_type);

-- EMAIL_ACCOUNTS: OAuth connections to Gmail/Outlook
CREATE TABLE email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- gmail, outlook
    email_address TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email_address)
);

-- EMAILS: Polled emails
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
    provider_message_id TEXT NOT NULL,
    subject TEXT,
    from_address TEXT,
    from_name TEXT,
    to_addresses TEXT[],
    received_at TIMESTAMPTZ,
    body_text TEXT,
    body_html TEXT,
    summary TEXT,
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    is_important BOOLEAN DEFAULT false,
    importance_reason TEXT,
    linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email_account_id, provider_message_id)
);

CREATE INDEX idx_emails_tenant ON emails(tenant_id, received_at DESC);
CREATE INDEX idx_emails_account ON emails(email_account_id, received_at DESC);

-- ADMIN_USERS: SaaS administrators (separate from tenant users)
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'admin', -- super_admin, admin, support
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT_LOG: Track important actions
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at DESC);

-- USAGE_TRACKING: Track usage for billing
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    bedrock_input_tokens BIGINT DEFAULT 0,
    bedrock_output_tokens BIGINT DEFAULT 0,
    whatsapp_messages_sent INTEGER DEFAULT 0,
    whatsapp_messages_received INTEGER DEFAULT 0,
    documents_processed INTEGER DEFAULT 0,
    emails_processed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, month)
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies will be added based on authentication strategy
-- For now, service role access bypasses RLS
