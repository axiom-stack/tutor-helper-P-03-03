-- Add due_date and whatsapp_message_text to Assignments (homework)
ALTER TABLE Assignments
  ADD COLUMN due_date TEXT;
ALTER TABLE Assignments
  ADD COLUMN whatsapp_message_text TEXT;
