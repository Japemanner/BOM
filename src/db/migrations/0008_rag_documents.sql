CREATE TABLE IF NOT EXISTS app.rag_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES app.assistants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_assistant_id ON app.rag_documents(assistant_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_tenant_id ON app.rag_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON app.rag_documents(status);
