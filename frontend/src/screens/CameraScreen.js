import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../lib/api";

function showAlert(title, msg) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${msg}`);
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, msg);
  }
}

export default function CameraScreen({ navigation }) {
  const [uploading, setUploading] = useState(false);

  const pickImage = async (useCamera) => {
    if (uploading) return;

    // Request permissions (auto-granted on web)
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showAlert("Permission Required", "Camera permission is needed to take photos.");
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert("Permission Required", "Photo library permission is needed to select photos.");
        return;
      }
    }

    const options = {
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
    };

    let result;
    try {
      result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    } catch (e) {
      showAlert("Error", "Could not open image picker: " + e.message);
      return;
    }

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      showAlert("Error", "Could not read image data.");
      return;
    }

    setUploading(true);

    try {
      // Get signed upload URL from backend
      const { upload_url, image_url } = await api.getUploadURL("photo.jpg");

      // Convert base64 to binary for upload
      const binaryString = atob(asset.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: bytes.buffer,
      });

      navigation.replace("Detect", { imageUrl: image_url, photoUri: asset.uri });
    } catch (e) {
      showAlert("Upload Failed", e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Add Item Photo</Text>
        <Text style={styles.subtitle}>
          Take a photo or choose one from your gallery
        </Text>

        {uploading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4a90d9" />
            <Text style={styles.loadingText}>Uploading photo...</Text>
          </View>
        ) : (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => pickImage(true)}
            >
              <Text style={styles.primaryButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => pickImage(false)}
            >
              <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f23" },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#888",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 48,
  },
  buttonGroup: {
    width: "100%",
  },
  primaryButton: {
    backgroundColor: "#4a90d9",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  secondaryButtonText: {
    color: "#4a90d9",
    fontSize: 17,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
  },
  loadingText: {
    color: "#aaa",
    fontSize: 15,
    marginTop: 16,
  },
});
