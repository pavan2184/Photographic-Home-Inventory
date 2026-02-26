-- Valuation history: one row per valuation computation
CREATE TABLE valuation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  valuation_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_valuation_history_item ON valuation_history(item_id, created_at DESC);

ALTER TABLE valuation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see history for their items" ON valuation_history
  FOR SELECT USING (
    item_id IN (SELECT id FROM items WHERE user_id = auth.uid())
  );
