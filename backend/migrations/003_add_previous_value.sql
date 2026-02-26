-- Migration 003: Add previous_value column for value change tracking
-- Run in Supabase SQL Editor

ALTER TABLE items ADD COLUMN previous_value NUMERIC NULL;
