-- Basic audit log for login and record edits
CREATE TABLE IF NOT EXISTS AuditLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL CHECK(action IN ('login', 'login_failure', 'record_edit')),
  user_id INTEGER REFERENCES Users(id),
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON AuditLog(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON AuditLog(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON AuditLog(user_id);
