-- Opsi "Sebulan 4 kali" (monthly4x) dihapus; setelan lama dipetakan ke "Setiap bulan" (monthly).
UPDATE "system_settings"
SET "reminder_frequency" = 'monthly'
WHERE "reminder_frequency" = 'monthly4x';

UPDATE "system_settings"
SET "bill_creation_frequency" = 'monthly'
WHERE "bill_creation_frequency" = 'monthly4x';
