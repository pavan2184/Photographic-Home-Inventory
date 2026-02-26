import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../lib/api";

export default function ItemDetailScreen({ route, navigation }) {
  const { itemId } = route.params;
  const [item, setItem] = useState(null);
  const [metadata, setMetadata] = useState([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [valuation, setValuation] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [recalculating, setRecalculating] = useState(false);

  // Editable purchase fields
  const [editPrice, setEditPrice] = useState("");
  const [editDate, setEditDate] = useState("");
  const [savingPurchase, setSavingPurchase] = useState(false);

  useEffect(() => {
    loadItem();
    loadMetadata();
  }, []);

  const loadItem = async () => {
    try {
      const data = await api.getItem(itemId);
      setItem(data);
      setEditPrice(data.purchase_price != null ? String(data.purchase_price) : "");
      setEditDate(data.purchase_date || "");
      if (data.purchase_price && data.purchase_date) {
        loadValuation();
      }
    } catch (e) {
      Alert.alert("Error", e.message);
      navigation.goBack();
    }
  };

  const loadValuation = async () => {
    setValuationLoading(true);
    try {
      const data = await api.getItemValuation(itemId);
      setValuation(data);
      loadHistory();
    } catch {
      // Valuation may not be available
      loadHistory();
    } finally {
      setValuationLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await api.getItemValuationHistory(itemId);
      setHistory(data);
    } catch {
      // History may not exist yet
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const data = await api.getItemValuation(itemId, true);
      setValuation(data);
      loadHistory();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setRecalculating(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const data = await api.listMetadata(itemId);
      setMetadata(data);
    } catch {
      // Metadata might not exist yet
    }
  };

  const handleSavePurchaseInfo = async () => {
    if (!editPrice.trim()) {
      return Alert.alert("Error", "Purchase price is required");
    }
    const price = parseFloat(editPrice.trim());
    if (isNaN(price) || price <= 0) {
      return Alert.alert("Error", "Purchase price must be a positive number");
    }
    if (!editDate.trim()) {
      return Alert.alert("Error", "Purchase date is required");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate.trim())) {
      return Alert.alert("Error", "Purchase date must be YYYY-MM-DD format");
    }

    setSavingPurchase(true);
    try {
      const updated = await api.updateItem(itemId, {
        purchase_price: price,
        purchase_date: editDate.trim(),
      });
      setItem(updated);
      // Give background valuation a moment, then load it
      setTimeout(() => loadValuation(), 2000);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSavingPurchase(false);
    }
  };

  const handleAddMetadata = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      return Alert.alert("Error", "Both key and value are required");
    }
    try {
      await api.addMetadata(itemId, newKey.trim(), newValue.trim());
      setNewKey("");
      setNewValue("");
      setShowAddForm(false);
      loadMetadata();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handleDeleteMetadata = (metaId, key) => {
    Alert.alert("Delete", `Remove "${key}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteMetadata(itemId, metaId);
            loadMetadata();
          } catch (e) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  const handleDeleteItem = () => {
    Alert.alert("Delete Item", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteItem(itemId);
            navigation.goBack();
          } catch (e) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  if (!item) return <View style={styles.container} />;

  const hasPurchaseData = item.purchase_price != null && item.purchase_date;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} bounces={true}>
      <Image source={{ uri: item.image_url }} style={styles.image} />

      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.category}>{item.category}</Text>
      {item.brand && <Text style={styles.brand}>{item.brand}</Text>}

      {item.confidence_score != null && (
        <Text style={styles.confidence}>
          Confidence: {Math.round(item.confidence_score * 100)}%
        </Text>
      )}

      <Text style={styles.date}>
        Added {new Date(item.created_at).toLocaleDateString()}
      </Text>

      {/* Valuation section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Valuation</Text>

        {hasPurchaseData ? (
          <>
            <View style={styles.valRow}>
              <Text style={styles.valLabel}>Purchase Price</Text>
              <Text style={styles.valValue}>SGD {Number(item.purchase_price).toFixed(2)}</Text>
            </View>

            <View style={styles.valRow}>
              <Text style={styles.valLabel}>Purchase Date</Text>
              <Text style={styles.valValue}>{item.purchase_date}</Text>
            </View>

            {valuationLoading ? (
              <ActivityIndicator size="small" color="#4a90d9" style={{ marginTop: 12 }} />
            ) : valuation ? (
              <>
                <View style={styles.valRow}>
                  <Text style={styles.valLabel}>Current Value</Text>
                  <Text style={styles.valValueGreen}>
                    SGD {valuation.final_value != null ? Number(valuation.final_value).toFixed(2) : "\u2014"}
                  </Text>
                </View>

                {valuation.value_trend && valuation.value_trend !== "unknown" && valuation.change_explanation && (
                  <View style={styles.valRow}>
                    <Text style={styles.valLabel}>Value Change</Text>
                    <Text style={[
                      styles.valValue,
                      { color: valuation.value_trend === "up" ? "#4caf50"
                              : valuation.value_trend === "down" ? "#f44336"
                              : "#888" }
                    ]}>
                      {valuation.change_explanation}
                    </Text>
                  </View>
                )}

                <View style={styles.valRow}>
                  <Text style={styles.valLabel}>Method</Text>
                  <Text style={styles.valValue}>
                    {valuation.valuation_method === "ai_resale_estimate"
                      ? "AI Resale Estimate"
                      : "Depreciation Model"}
                  </Text>
                </View>

                {valuation.explanation && (
                  <Text style={styles.valExplanation}>{valuation.explanation}</Text>
                )}

                <TouchableOpacity
                  style={styles.recalcButton}
                  onPress={handleRecalculate}
                  disabled={recalculating}
                >
                  <Text style={styles.recalcButtonText}>
                    {recalculating ? "Recalculating..." : "Recalculate Value"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : item.estimated_resale_value != null ? (
              <View style={styles.valRow}>
                <Text style={styles.valLabel}>Current Value</Text>
                <Text style={styles.valValueGreen}>
                  SGD {Number(item.estimated_resale_value).toFixed(2)}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.purchaseForm}>
            <Text style={styles.purchaseHint}>
              Add purchase info to get a valuation estimate
            </Text>
            <Text style={styles.fieldLabel}>Purchase Price (SGD)</Text>
            <TextInput
              style={styles.input}
              value={editPrice}
              onChangeText={setEditPrice}
              placeholder="e.g. 599.00"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLabel}>Purchase Date</Text>
            <TextInput
              style={styles.input}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#555"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSavePurchaseInfo}
              disabled={savingPurchase}
            >
              <Text style={styles.saveButtonText}>
                {savingPurchase ? "Saving..." : "Save & Get Valuation"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Metadata section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Details</Text>
          <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)}>
            <Text style={styles.addButton}>{showAddForm ? "Cancel" : "+ Add"}</Text>
          </TouchableOpacity>
        </View>

        {showAddForm && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Key (e.g. serial_number)"
              placeholderTextColor="#555"
              value={newKey}
              onChangeText={setNewKey}
            />
            <TextInput
              style={styles.input}
              placeholder="Value"
              placeholderTextColor="#555"
              value={newValue}
              onChangeText={setNewValue}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddMetadata}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {metadata.length === 0 && !showAddForm && (
          <Text style={styles.emptyMeta}>No additional details</Text>
        )}

        {metadata.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={styles.metaRow}
            onLongPress={() => handleDeleteMetadata(m.id, m.key)}
          >
            <Text style={styles.metaKey}>{m.key}</Text>
            <Text style={styles.metaValue}>{m.value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Price History section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price History</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyMeta}>No valuation history yet</Text>
        ) : (
          <View style={styles.historyTable}>
            <View style={styles.historyHeaderRow}>
              <Text style={[styles.historyHeaderCell, styles.historyDateCol]}>Date</Text>
              <Text style={[styles.historyHeaderCell, styles.historyValueCol]}>Value (SGD)</Text>
              <Text style={[styles.historyHeaderCell, styles.historyChangeCol]}>Change</Text>
            </View>
            {history.map((entry, index) => {
              const olderEntry = history[index + 1];
              let changeText = "";
              let changeColor = "#888";
              if (olderEntry) {
                const diff = entry.value - olderEntry.value;
                if (diff > 0) {
                  changeText = `+${diff.toFixed(2)}`;
                  changeColor = "#4caf50";
                } else if (diff < 0) {
                  changeText = diff.toFixed(2);
                  changeColor = "#f44336";
                } else {
                  changeText = "0.00";
                }
              }
              return (
                <View key={entry.id} style={styles.historyRow}>
                  <Text style={[styles.historyCell, styles.historyDateCol]}>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.historyCell, styles.historyValueCol]}>
                    {Number(entry.value).toFixed(2)}
                  </Text>
                  <Text style={[styles.historyCell, styles.historyChangeCol, { color: changeColor }]}>
                    {changeText || "\u2014"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteItem}>
        <Text style={styles.deleteText}>Delete Item</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f23", minHeight: 0 },
  content: { padding: 16, paddingBottom: 100 },
  image: { width: "100%", height: 260, borderRadius: 12, backgroundColor: "#1a1a2e" },
  name: { color: "#fff", fontSize: 24, fontWeight: "bold", marginTop: 16 },
  category: { color: "#4a90d9", fontSize: 16, marginTop: 4 },
  brand: { color: "#aaa", fontSize: 15, marginTop: 2 },
  confidence: { color: "#888", fontSize: 14, marginTop: 8 },
  date: { color: "#555", fontSize: 13, marginTop: 4 },
  section: { marginTop: 28 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  addButton: { color: "#4a90d9", fontSize: 15, fontWeight: "600" },
  addForm: { marginTop: 12, gap: 8 },
  purchaseForm: { marginTop: 12, gap: 8 },
  purchaseHint: { color: "#888", fontSize: 13, marginBottom: 4 },
  fieldLabel: { color: "#aaa", fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "#1a1a2e",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  saveButton: { backgroundColor: "#4a90d9", borderRadius: 8, padding: 12, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "600" },
  emptyMeta: { color: "#555", marginTop: 12 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
  },
  metaKey: { color: "#aaa", fontSize: 14 },
  metaValue: { color: "#fff", fontSize: 14, fontWeight: "500" },
  valRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
  },
  valLabel: { color: "#aaa", fontSize: 14 },
  valValue: { color: "#fff", fontSize: 14, fontWeight: "500" },
  valValueGreen: { color: "#4caf50", fontSize: 16, fontWeight: "700" },
  valExplanation: { color: "#888", fontSize: 13, marginTop: 8, lineHeight: 18 },
  recalcButton: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4a90d9",
    alignItems: "center",
  },
  recalcButtonText: { color: "#4a90d9", fontSize: 14, fontWeight: "600" },
  historyTable: { marginTop: 12 },
  historyHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a4a",
    paddingBottom: 8,
  },
  historyHeaderCell: { color: "#888", fontSize: 13, fontWeight: "600" },
  historyRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a2e",
  },
  historyCell: { color: "#fff", fontSize: 14 },
  historyDateCol: { flex: 2 },
  historyValueCol: { flex: 2, textAlign: "right" },
  historyChangeCol: { flex: 1.5, textAlign: "right" },
  deleteButton: {
    marginTop: 32,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f44336",
    alignItems: "center",
  },
  deleteText: { color: "#f44336", fontSize: 16, fontWeight: "600" },
});
