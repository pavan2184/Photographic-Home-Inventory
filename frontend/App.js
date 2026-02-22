import "react-native-gesture-handler";
import React from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CameraScreen from "./src/screens/CameraScreen";
import DetectScreen from "./src/screens/DetectScreen";
import ItemDetailScreen from "./src/screens/ItemDetailScreen";

const Stack = createStackNavigator();

function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f23" }}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
        cardStyle: { backgroundColor: "#0f0f23" },
      }}
    >
      {session ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "My Inventory" }} />
          <Stack.Screen name="Camera" component={CameraScreen} options={{ title: "Take Photo" }} />
          <Stack.Screen name="Detect" component={DetectScreen} options={{ title: "Identify Item" }} />
          <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: "Item Details" }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
