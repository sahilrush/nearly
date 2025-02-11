module.exports = {
  setupFilesAfterEnv: ["<rootDir>/jest-setup.js"],
  preset: "react-native",
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage)/)",
  ],
};
