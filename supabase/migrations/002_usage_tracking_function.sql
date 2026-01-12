-- Function to increment usage tracking counters
-- Called by Lambda functions to track WhatsApp messages, document processing, etc.

CREATE OR REPLACE FUNCTION increment_usage(
    p_tenant_id UUID,
    p_month DATE,
    p_whatsapp_received INTEGER DEFAULT 0,
    p_whatsapp_sent INTEGER DEFAULT 0,
    p_documents_processed INTEGER DEFAULT 0,
    p_emails_processed INTEGER DEFAULT 0,
    p_bedrock_input_tokens BIGINT DEFAULT 0,
    p_bedrock_output_tokens BIGINT DEFAULT 0
)
RETURNS void AS $$
BEGIN
    INSERT INTO usage_tracking (
        tenant_id,
        month,
        whatsapp_messages_received,
        whatsapp_messages_sent,
        documents_processed,
        emails_processed,
        bedrock_input_tokens,
        bedrock_output_tokens
    )
    VALUES (
        p_tenant_id,
        p_month,
        p_whatsapp_received,
        p_whatsapp_sent,
        p_documents_processed,
        p_emails_processed,
        p_bedrock_input_tokens,
        p_bedrock_output_tokens
    )
    ON CONFLICT (tenant_id, month)
    DO UPDATE SET
        whatsapp_messages_received = usage_tracking.whatsapp_messages_received + p_whatsapp_received,
        whatsapp_messages_sent = usage_tracking.whatsapp_messages_sent + p_whatsapp_sent,
        documents_processed = usage_tracking.documents_processed + p_documents_processed,
        emails_processed = usage_tracking.emails_processed + p_emails_processed,
        bedrock_input_tokens = usage_tracking.bedrock_input_tokens + p_bedrock_input_tokens,
        bedrock_output_tokens = usage_tracking.bedrock_output_tokens + p_bedrock_output_tokens,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
