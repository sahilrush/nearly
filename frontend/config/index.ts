// Get your actual IP address and replace it here
export const BASE_URL = "192.168.1.X"; // Replace X with your actual IP
export const API_URL = `http://${BASE_URL}:3000`;
export const WS_URL = `ws://${BASE_URL}:8080`;

// For debugging
console.log("API URL:", API_URL);
console.log("WS URL:", WS_URL);
