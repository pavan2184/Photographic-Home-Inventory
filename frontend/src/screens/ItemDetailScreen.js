import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
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

  useEffect(() => {
    loadItem();
    loadMetadata();
  }, []);

  const loadItem = async () => {
    try {
      const data = await api.getItem(itemId);
      setItem(data);
    } catch (e) {
      Alert.alert("Error", e.message);
      navigation.goBack();
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteItem}>
        <Text style={styles.deleteText}>Delete Item</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f23" },
  content: { padding: 16, paddingBottom: 40 },
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
