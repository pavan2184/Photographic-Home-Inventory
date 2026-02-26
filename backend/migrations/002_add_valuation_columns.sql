-- Add valuation & depreciation tracking columns to items table
ALTER TABLE items
  ADD COLUMN purchase_price    NUMERIC        NULL,
  ADD COLUMN purchase_date     DATE           NULL,
  ADD COLUMN estimated_resale_value NUMERIC   NULL,
  ADD COLUMN resale_currency   TEXT           DEFAULT 'SGD',
  ADD COLUMN depreciation_rate NUMERIC        NULL,
  ADD COLUMN value_last_updated TIMESTAMPTZ   NULL;
