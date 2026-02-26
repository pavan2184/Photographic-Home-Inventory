import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../lib/api";

function showAlert(title, msg) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${msg}`);
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, msg);
  }
}

export default function DetectScreen({ route, navigation }) {
  const { imageUrl, photoUri } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [isUncertain, setIsUncertain] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  useEffect(() => {
    detectItem();
  }, []);

  const detectItem = async () => {
    try {
      const result = await api.detect(imageUrl);
      setName(result.suggested_name || "");
      setCategory(result.suggested_category || "");
      setBrand(result.brand || "");
      setConfidence(result.confidence);
      setIsUncertain(result.is_uncertain);
      if (result.is_uncertain) setEditable(true);
    } catch (e) {
      setError(e.message || "Detection failed");
      setEditable(true);
      setIsUncertain(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!name.trim()) return showAlert("Error", "Name is required");
    if (!category.trim()) return showAlert("Error", "Category is required");

    // Validate purchase price if entered
    if (purchasePrice.trim()) {
      const price = parseFloat(purchasePrice.trim());
      if (isNaN(price) || price <= 0) {
        return showAlert("Error", "Purchase price must be a positive number");
      }
    }

    // Validate purchase date if entered
    if (purchaseDate.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate.trim())) {
        return showAlert("Error", "Purchase date must be YYYY-MM-DD format");
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        brand: brand.trim() || null,
        image_url: imageUrl,
        confidence_score: editable ? 0 : confidence,
      };
      if (purchasePrice.trim()) {
        payload.purchase_price = parseFloat(purchasePrice.trim());
      }
      if (purchaseDate.trim()) {
        payload.purchase_date = purchaseDate.trim();
      }
      await api.createItem(payload);
      navigation.popToTop();
    } catch (e) {
      showAlert("Save Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleManual = () => {
    setName("");
    setCategory("");
    setBrand("");
    setConfidence(0);
    setEditable(true);
    setIsUncertain(true);
  };

  const confidenceColor =
    confidence >= 0.7 ? "#4caf50" : confidence >= 0.5 ? "#ff9800" : "#f44336";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4a90d9" />
        <Text style={styles.loadingText}>Identifying item...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={{ uri: photoUri }} style={styles.image} />

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>Enter item details manually below</Text>
        </View>
      ) : isUncertain && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Low confidence — please review or enter details manually
          </Text>
        </View>
      )}

      <View style={styles.confidenceRow}>
        <Text style={styles.label}>Confidence</Text>
        <View style={styles.confidenceBar}>
          <View
            style={[styles.confidenceFill, { width: `${confidence * 100}%`, backgroundColor: confidenceColor }]}
          />
        </View>
        <Text style={[styles.confidenceValue, { color: confidenceColor }]}>
          {Math.round(confidence * 100)}%
        </Text>
      </View>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={name}
        onChangeText={setName}
        editable={editable}
        placeholder="Item name"
        placeholderTextColor="#555"
      />

      <Text style={styles.label}>Category</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={category}
        onChangeText={setCategory}
        editable={editable}
        placeholder="Category"
        placeholderTextColor="#555"
      />

      <Text style={styles.label}>Brand</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={brand}
        onChangeText={setBrand}
        editable={editable}
        placeholder="Brand (optional)"
        placeholderTextColor="#555"
      />

      <Text style={styles.label}>Purchase Price (SGD)</Text>
      <TextInput
        style={styles.input}
        value={purchasePrice}
        onChangeText={setPurchasePrice}
        placeholder="e.g. 299.00 (optional)"
        placeholderTextColor="#555"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Purchase Date</Text>
      <TextInput
        style={styles.input}
        value={purchaseDate}
        onChangeText={setPurchaseDate}
        placeholder="YYYY-MM-DD (optional)"
        placeholderTextColor="#555"
      />

      <View style={styles.actions}>
        {!editable && (
          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={handleConfirm}
            disabled={saving}
          >
            <Text style={styles.actionText}>{saving ? "Saving..." : "Confirm"}</Text>
          </TouchableOpacity>
        )}

        {!editable && (
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => setEditable(true)}
          >
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
        )}

        {editable && (
          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={handleConfirm}
            disabled={saving}
          >
            <Text style={styles.actionText}>{saving ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.manualButton]}
          onPress={handleManual}
        >
          <Text style={styles.actionText}>Enter Manually</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f23" },
  content: { padding: 16 },
  centered: { flex: 1, backgroundColor: "#0f0f23", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#aaa", marginTop: 16, fontSize: 16 },
  image: { width: "100%", height: 240, borderRadius: 12, backgroundColor: "#1a1a2e" },
  warningBanner: {
    backgroundColor: "#ff980020",
    borderWidth: 1,
    borderColor: "#ff9800",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: { color: "#ff9800", fontSize: 14, textAlign: "center" },
  errorBanner: {
    backgroundColor: "#f4433620",
    borderWidth: 1,
    borderColor: "#f44336",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: { color: "#f44336", fontSize: 14, textAlign: "center", fontWeight: "600" },
  errorSubtext: { color: "#f4433699", fontSize: 13, textAlign: "center", marginTop: 4 },
  confidenceRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8 },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#2a2a4a",
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  confidenceFill: { height: "100%", borderRadius: 4 },
  confidenceValue: { fontSize: 14, fontWeight: "600", width: 42, textAlign: "right" },
  label: { color: "#aaa", fontSize: 13, marginTop: 12, marginBottom: 4, fontWeight: "600" },
  input: {
    backgroundColor: "#1a1a2e",
    color: "#fff",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  inputDisabled: { opacity: 0.7 },
  actions: { marginTop: 24, gap: 10 },
  actionButton: { borderRadius: 10, padding: 16, alignItems: "center" },
  confirmButton: { backgroundColor: "#4a90d9" },
  editButton: { backgroundColor: "#2a2a4a" },
  manualButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#555" },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
