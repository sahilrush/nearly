import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as z from "zod";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/context/AuthContext";
import {
  AuthResponse,
  SigninData,
  signinSchema,
  SignupData,
  signupSchema,
} from "@/types/auth";

type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
};

type AuthScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Auth"
>;

interface Props {
  navigation: AuthScreenNavigationProp;
}

const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const auth = useAuth();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<SignupData>({
    username: "",
    email: "",
    password: "",
  });

  const API_URL: string = "http://localhost:3000";

  const handleAuth = async () => {
    try {
      setIsLoading(true);
      console.log("Attempting to sign in..."); // Debugging

      const endpoint = isLogin ? "/auth/signin" : "/auth/signup";
      const userData = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      console.log("Response:", data); // Debugging

      if (response.ok) {
        if (isLogin) {
          console.log("Logging in...");
          await auth.login(data.token); // Ensure this is working
        } else {
          Alert.alert("Success", "Account created! Please sign in.");
          setIsLogin(true);
          setFormData({ username: "", email: "", password: "" });
        }
      } else {
        Alert.alert("Error", data.message);
      }
    } catch (error) {
      console.error("Auth error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (key: keyof SignupData, value: string): void => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: "",
      }));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? "Login" : "Sign Up"}</Text>
      {!isLogin && (
        <View>
          <TextInput
            style={[styles.input, errors.username && styles.inputError]}
            placeholder="Username"
            value={formData.username}
            onChange={(e) => updateFormData("username", e.nativeEvent.text)}
            autoCapitalize="none"
          />
          {errors.username && (
            <Text style={styles.errorText}>{errors.username}</Text>
          )}
        </View>
      )}

      <View>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Email"
          value={formData.email}
          onChange={(e) => updateFormData("email", e.nativeEvent.text)}
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View>
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Password"
          value={formData.password}
          onChange={(e) => updateFormData("password", e.nativeEvent.text)}
          secureTextEntry
        />
        {errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleAuth}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isLogin ? "Sign In" : "Sign Up"}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => {
          setIsLogin(!isLogin);
          setErrors({});
        }}
        disabled={isLoading}
      >
        <Text style={styles.switchButtonText}>
          {isLogin
            ? "Don't have an account? Sign Up"
            : "Already have account? Sign In"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#ff3b30",
  },
  errorText: {
    color: "#ff3b30",
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 5,
  },
  button: {
    backgroundColor: "#007AFF",
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 20,
  },
  switchButtonText: {
    color: "#007AFF",
    textAlign: "center",
    fontSize: 14,
  },
});

export default AuthScreen;
