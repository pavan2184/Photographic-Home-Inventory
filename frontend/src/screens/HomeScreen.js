import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function HomeScreen({ navigation }) {
  const { signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await api.listItems();
      setItems(data);
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("ItemDetail", { itemId: item.id })}
    >
      <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
      <View style={styles.cardContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
        {item.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 && styles.emptyContainer}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.dashboardBanner}
            onPress={() => navigation.navigate("Dashboard")}
          >
            <Text style={styles.dashboardBannerText}>View Asset Dashboard</Text>
            <Text style={styles.dashboardBannerArrow}>&rsaquo;</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items yet</Text>
            <Text style={styles.emptySubtext}>Tap + to photograph an item</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a90d9" />
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("Camera")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f23" },
  card: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  thumbnail: { width: 80, height: 80, backgroundColor: "#2a2a4a" },
  cardContent: { flex: 1, padding: 12, justifyContent: "center" },
  itemName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  itemCategory: { color: "#4a90d9", fontSize: 13, marginTop: 4 },
  itemBrand: { color: "#888", fontSize: 13, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 120 },
  emptyText: { color: "#888", fontSize: 18 },
  emptySubtext: { color: "#555", fontSize: 14, marginTop: 8 },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4a90d9",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
  dashboardBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#4caf5040",
  },
  dashboardBannerText: { color: "#4caf50", fontSize: 15, fontWeight: "600" },
  dashboardBannerArrow: { color: "#4caf50", fontSize: 22, fontWeight: "bold" },
  signOut: { position: "absolute", left: 24, bottom: 40 },
  signOutText: { color: "#666", fontSize: 14 },
});
