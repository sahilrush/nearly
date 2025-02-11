export interface BaseMessage {
  type: string;
}

export interface RegisterMessage extends BaseMessage {
  type: "register";
  userId: string;
}

export interface LocationUpdateMessage extends BaseMessage {
  type: "update_location";
  userId: string;
  latitude: number;
  longitude: number;
}

export interface NearbyUserMessage extends BaseMessage {
  type: "nearby_users";
  users: string[];
  yourLocation: {
    latitude: number;
    longitude: number;
  };
}

export interface ErrorMessage extends BaseMessage {
  type: "error";
  message: string;
}

export interface UserProximityMessage extends BaseMessage {
  type: "user_entered_proximity";
  userId: string;
  location: {
    latitude: number;
    longitutde: number;
  };
}

export type WebSocketMessage =
  | RegisterMessage
  | LocationUpdateMessage
  | NearbyUserMessage
  | UserProximityMessage
  | ErrorMessage;
