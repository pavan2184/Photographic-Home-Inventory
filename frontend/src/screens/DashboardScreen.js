import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../lib/api";

export default function DashboardScreen() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.getAssetSummary();
      setSummary(data);
    } catch {
      // Silently fail on load
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSummary();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Unable to load asset summary</Text>
      </View>
    );
  }

  const depreciation = summary.total_purchase_value - summary.total_current_value;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a90d9" />
      }
    >
      {/* Hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total Current Value</Text>
        <Text style={styles.heroValue}>
          {summary.currency} {summary.total_current_value.toFixed(2)}
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{summary.total_items}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{summary.items_with_valuation}</Text>
          <Text style={styles.statLabel}>Valued</Text>
        </View>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Breakdown</Text>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Purchase Value</Text>
          <Text style={styles.breakdownValue}>
            {summary.currency} {summary.total_purchase_value.toFixed(2)}
          </Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Current Value</Text>
          <Text style={[styles.breakdownValue, { color: "#4caf50" }]}>
            {summary.currency} {summary.total_current_value.toFixed(2)}
          </Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Total Depreciation</Text>
          <Text style={[styles.breakdownValue, { color: "#f44336" }]}>
            -{summary.currency} {depreciation > 0 ? depreciation.toFixed(2) : "0.00"}
          </Text>
        </View>

        {summary.portfolio_change != null && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Value Change</Text>
            <Text style={[styles.breakdownValue, {
              color: summary.portfolio_change > 0 ? "#4caf50"
                   : summary.portfolio_change < 0 ? "#f44336"
                   : "#888"
            }]}>
              {summary.portfolio_change >= 0 ? "+" : ""}{summary.currency} {summary.portfolio_change.toFixed(2)}
              {summary.portfolio_change_percent != null
                ? ` (${summary.portfolio_change_percent >= 0 ? "+" : ""}${summary.portfolio_change_percent}%)`
                : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Footnote */}
      {summary.items_without_valuation > 0 && (
        <Text style={styles.footnote}>
          {summary.items_without_valuation} item{summary.items_without_valuation > 1 ? "s" : ""} without
          valuation (no purchase price entered)
        </Text>
      )}

      {summary.last_updated && (
        <Text style={styles.footnote}>
          Last updated: {new Date(summary.last_updated).toLocaleString()}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f23" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: "#0f0f23", justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#888", fontSize: 16 },
  heroCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4caf5040",
  },
  heroLabel: { color: "#aaa", fontSize: 14, marginBottom: 8 },
  heroValue: { color: "#4caf50", fontSize: 36, fontWeight: "bold" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statNumber: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  statLabel: { color: "#aaa", fontSize: 13, marginTop: 4 },
  breakdownCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  breakdownTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
  },
  breakdownLabel: { color: "#aaa", fontSize: 14 },
  breakdownValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  footnote: { color: "#555", fontSize: 12, marginTop: 16, textAlign: "center" },
});
