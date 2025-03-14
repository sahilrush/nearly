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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/context/AuthContext";
import { SignupData } from "@/types/auth";
import { API_URL } from "@/config";

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

  const handleAuth = async () => {
    try {
      setIsLoading(true);
      const endpoint = isLogin ? "/auth/signin" : "/auth/signup";
      console.log("Attempting to sign in...");
      console.log("Using API URL:", `${API_URL}${endpoint}`);

      const userData = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(userData),
      }).catch((error) => {
        console.error("Fetch error details:", error);
        throw error;
      });

      const data = await response.json();
      console.log("Response:", data);

      if (response.ok) {
        if (isLogin && data.token) {
          console.log("Logging in with token:", data.token);
          try {
            // Extract userId from token without using atob
            const tokenParts = data.token.split(".");
            const base64Url = tokenParts[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split("")
                .map(
                  (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                )
                .join("")
            );
            const payload = JSON.parse(jsonPayload);

            if (!payload.userId) {
              throw new Error("No userId in token payload");
            }

            await auth.login(data.token, payload.userId);
          } catch (error) {
            console.error("Token parsing error:", error);
            Alert.alert("Error", "Invalid token format");
          }
        } else if (!isLogin) {
          Alert.alert("Success", "Account created! Please sign in.");
          setIsLogin(true);
          setFormData({ username: "", email: "", password: "" });
        }
      } else {
        Alert.alert("Error", data.message || "Authentication failed");
      }
    } catch (error) {
      console.error("Auth error:", error);
      Alert.alert("Error", "Network or server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (key: keyof SignupData, value: string): void => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));

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
