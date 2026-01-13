-- Migration: Crew Invitation System
-- Phase 3: Project Management Enhancement

-- PENDING_INVITATIONS: Track invitations sent to crew members
CREATE TABLE pending_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    invited_by_user_id UUID REFERENCES users(id) NOT NULL,
    phone_number TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'crew', -- crew, lead
    status TEXT DEFAULT 'pending', -- pending, accepted, expired, cancelled
    invitation_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
    message TEXT, -- Custom message to include in invitation
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone_number, project_id) -- One invitation per phone/project combo
);

CREATE INDEX idx_invitations_phone ON pending_invitations(phone_number);
CREATE INDEX idx_invitations_status ON pending_invitations(status) WHERE status = 'pending';
CREATE INDEX idx_invitations_code ON pending_invitations(invitation_code);
CREATE INDEX idx_invitations_tenant ON pending_invitations(tenant_id);

-- Function to accept an invitation
CREATE OR REPLACE FUNCTION accept_invitation(
    p_phone_number TEXT,
    p_invitation_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    user_id UUID,
    tenant_id UUID,
    project_id UUID,
    tenant_name TEXT,
    project_name TEXT,
    role TEXT,
    message TEXT
) AS $$
DECLARE
    v_invitation pending_invitations%ROWTYPE;
    v_user_id UUID;
    v_tenant_name TEXT;
    v_project_name TEXT;
BEGIN
    -- Find pending invitation by phone number (and optionally code)
    IF p_invitation_code IS NOT NULL THEN
        SELECT * INTO v_invitation
        FROM pending_invitations
        WHERE phone_number = p_phone_number
          AND invitation_code = p_invitation_code
          AND status = 'pending'
          AND (expires_at IS NULL OR expires_at > NOW());
    ELSE
        -- Get the most recent pending invitation for this phone
        SELECT * INTO v_invitation
        FROM pending_invitations
        WHERE phone_number = p_phone_number
          AND status = 'pending'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_invitation IS NULL THEN
        RETURN QUERY SELECT
            false,
            NULL::UUID,
            NULL::UUID,
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            NULL::TEXT,
            'No pending invitation found'::TEXT;
        RETURN;
    END IF;

    -- Get tenant name
    SELECT name INTO v_tenant_name FROM tenants WHERE id = v_invitation.tenant_id;

    -- Get project name if applicable
    IF v_invitation.project_id IS NOT NULL THEN
        SELECT name INTO v_project_name FROM projects WHERE id = v_invitation.project_id;
    END IF;

    -- Check if user already exists
    SELECT id INTO v_user_id
    FROM users
    WHERE phone_number = p_phone_number AND tenant_id = v_invitation.tenant_id;

    IF v_user_id IS NULL THEN
        -- Create new user
        INSERT INTO users (tenant_id, phone_number, name, role, is_active)
        VALUES (
            v_invitation.tenant_id,
            p_phone_number,
            v_invitation.name,
            v_invitation.role,
            true
        )
        RETURNING id INTO v_user_id;
    END IF;

    -- Assign to project if specified
    IF v_invitation.project_id IS NOT NULL THEN
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (v_invitation.project_id, v_user_id, v_invitation.role)
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = v_invitation.role;
    END IF;

    -- Mark invitation as accepted
    UPDATE pending_invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = v_invitation.id;

    RETURN QUERY SELECT
        true,
        v_user_id,
        v_invitation.tenant_id,
        v_invitation.project_id,
        v_tenant_name,
        v_project_name,
        v_invitation.role,
        'Invitation accepted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel expired invitations (can be called by cron)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE pending_invitations
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Add invitation tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending_invitations (tenant isolation)
CREATE POLICY "Tenant isolation for invitations"
    ON pending_invitations
    FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
    ));
