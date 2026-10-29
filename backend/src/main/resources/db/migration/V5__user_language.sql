-- App language, so push alerts and e-mails reach each traveller in the language they use Gatemate in.
ALTER TABLE users ADD COLUMN lang VARCHAR(5) NOT NULL DEFAULT 'en';
