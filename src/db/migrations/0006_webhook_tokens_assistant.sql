ALTER TABLE app.webhook_tokens
  ADD COLUMN assistant_id uuid REFERENCES app.assistants(id) ON DELETE CASCADE;

CREATE INDEX idx_webhook_tokens_assistant_id ON app.webhook_tokens (assistant_id);