-- #23 Currency picker (docs/features/currency.md → Data model): the curated set of 25 travel
-- currencies, all active, in the picker's order. Each changed row takes the next changeSeq so
-- devices pull it; THB is unchanged. LAK and TWD drop to 0 digits (currency rule 2: digits used
-- in practice), but only while no wallet uses them, since that would rescale stored amounts.
INSERT INTO `currencies` (`code`, `minor_unit`, `is_active`, `sort_order`, `created_at`, `updated_at`, `change_seq`)
SELECT v.code, v.minor_unit, 1, v.sort_order, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000,
  (SELECT `last_seq` FROM `sync_state` WHERE `id` = 1) + v.n
FROM (
  SELECT 'MOP' AS code, 2 AS minor_unit, 5 AS sort_order, 1 AS n
  UNION ALL SELECT 'KHR', 0, 11, 2
  UNION ALL SELECT 'IDR', 0, 12, 3
  UNION ALL SELECT 'PHP', 2, 13, 4
  UNION ALL SELECT 'MMK', 0, 14, 5
  UNION ALL SELECT 'INR', 2, 15, 6
  UNION ALL SELECT 'AED', 2, 16, 7
  UNION ALL SELECT 'CHF', 2, 19, 8
  UNION ALL SELECT 'TRY', 2, 20, 9
  UNION ALL SELECT 'CAD', 2, 22, 10
  UNION ALL SELECT 'NZD', 2, 24, 11
) AS v;
--> statement-breakpoint
UPDATE `sync_state` SET `last_seq` = `last_seq` + 11 WHERE `id` = 1;
--> statement-breakpoint
UPDATE `currencies` SET
  `is_active` = 1,
  `sort_order` = CASE `code`
    WHEN 'JPY' THEN 1 WHEN 'KRW' THEN 2 WHEN 'CNY' THEN 3 WHEN 'HKD' THEN 4 WHEN 'TWD' THEN 6
    WHEN 'SGD' THEN 7 WHEN 'MYR' THEN 8 WHEN 'VND' THEN 9 WHEN 'LAK' THEN 10 WHEN 'EUR' THEN 17
    WHEN 'GBP' THEN 18 WHEN 'USD' THEN 21 WHEN 'AUD' THEN 23 END,
  `minor_unit` = CASE
    WHEN `code` IN ('LAK', 'TWD')
      AND NOT EXISTS (SELECT 1 FROM `wallets` WHERE `wallets`.`currency_code` = `currencies`.`code`)
    THEN 0 ELSE `minor_unit` END,
  `updated_at` = strftime('%s', 'now') * 1000,
  `change_seq` = (SELECT `last_seq` FROM `sync_state` WHERE `id` = 1) + CASE `code`
    WHEN 'JPY' THEN 1 WHEN 'KRW' THEN 2 WHEN 'CNY' THEN 3 WHEN 'HKD' THEN 4 WHEN 'TWD' THEN 5
    WHEN 'SGD' THEN 6 WHEN 'MYR' THEN 7 WHEN 'VND' THEN 8 WHEN 'LAK' THEN 9 WHEN 'EUR' THEN 10
    WHEN 'GBP' THEN 11 WHEN 'USD' THEN 12 WHEN 'AUD' THEN 13 END
WHERE `code` IN ('JPY', 'KRW', 'CNY', 'HKD', 'TWD', 'SGD', 'MYR', 'VND', 'LAK', 'EUR', 'GBP', 'USD', 'AUD');
--> statement-breakpoint
UPDATE `sync_state` SET `last_seq` = `last_seq` + 13 WHERE `id` = 1;
