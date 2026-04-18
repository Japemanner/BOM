CREATE TABLE app.webhook_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  token_hash    text NOT NULL UNIQUE,
  created_at    timestamp NOT NULL DEFAULT now(),
  last_used_at  timestamp
);

ALTER TABLE app.assistants
  ADD COLUMN webhook_url             text,
  ADD COLUMN webhook_token_encrypted text;

INSERT INTO rbac.permissions (id, resource, action, description)
VALUES ('webhooks.manage', 'webhooks', 'manage', 'Webhook tokens beheren')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rbac.role_permissions (role_id, permission_id)
VALUES ('admin', 'webhooks.manage')
ON CONFLICT DO NOTHING;

CREATE INDEX ON app.webhook_tokens (tenant_id);
