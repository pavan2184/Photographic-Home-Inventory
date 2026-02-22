import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

function showAlert(title, msg) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${msg}`);
  } else {
    const { Alert } = require("react-native");
    Alert.alert(title, msg);
  }
}

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    setError("");
    if (!email || !password) return setError("Fill in all fields");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError("");
    if (!email || !password) return setError("Fill in all fields");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await signUp(email, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Home Inventory</Text>
        <Text style={styles.subtitle}>Track your belongings with AI</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={[styles.buttonText, styles.secondaryText]}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#aaa", textAlign: "center", marginBottom: 40, marginTop: 8 },
  error: { color: "#f44336", textAlign: "center", marginBottom: 12, fontSize: 14 },
  input: {
    backgroundColor: "#16213e",
    color: "#fff",
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2a2a4a",
  },
  button: { borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
  primaryButton: { backgroundColor: "#4a90d9" },
  secondaryButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#4a90d9" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryText: { color: "#4a90d9" },
});
