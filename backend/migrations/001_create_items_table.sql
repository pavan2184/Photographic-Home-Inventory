-- Run this in the Supabase SQL Editor

-- Items table
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    confidence_score FLOAT,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_user_category ON items(user_id, category);

-- Item metadata (key-value pairs)
CREATE TABLE item_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(item_id, key)
);

CREATE INDEX idx_item_metadata_item_id ON item_metadata(item_id);

-- Row Level Security for items
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own items"
    ON items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items"
    ON items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
    ON items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
    ON items FOR DELETE
    USING (auth.uid() = user_id);

-- Row Level Security for item_metadata (via item ownership)
ALTER TABLE item_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own item metadata"
    ON item_metadata FOR SELECT
    USING (item_id IN (SELECT id FROM items WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own item metadata"
    ON item_metadata FOR INSERT
    WITH CHECK (item_id IN (SELECT id FROM items WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own item metadata"
    ON item_metadata FOR UPDATE
    USING (item_id IN (SELECT id FROM items WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own item metadata"
    ON item_metadata FOR DELETE
    USING (item_id IN (SELECT id FROM items WHERE user_id = auth.uid()));
