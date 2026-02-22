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

export default function DetectScreen({ route, navigation }) {
  const { imageUrl, photoUri } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [isUncertain, setIsUncertain] = useState(false);

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
      // Auto-enable editing if AI is uncertain
      if (result.is_uncertain) setEditable(true);
    } catch (e) {
      Alert.alert("Detection Failed", "Couldn't identify item. Enter details manually.");
      setEditable(true);
      setIsUncertain(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!name.trim()) return Alert.alert("Error", "Name is required");
    if (!category.trim()) return Alert.alert("Error", "Category is required");

    setSaving(true);
    try {
      await api.createItem({
        name: name.trim(),
        category: category.trim(),
        brand: brand.trim() || null,
        image_url: imageUrl,
        confidence_score: editable ? 0 : confidence,
      });
      navigation.popToTop();
    } catch (e) {
      Alert.alert("Save Failed", e.message);
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

      {isUncertain && (
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
