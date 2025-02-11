export interface LocationUpdate {
  type: "update_location";
  userId: string;
  latitude: number;
  longitude: number;
}

export interface NearbyUsers {
  type: "nearby_users";
  users: string[];
  yourLocation: {
    latitude: number;
    longitude: number;
  };
}

export interface UserProximity {
  type: "user_entered_proximity";
  userId: string;
  location: {
    latitude: number;
    longitude: number;
  };
}
