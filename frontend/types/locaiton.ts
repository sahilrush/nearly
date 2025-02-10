
export const WS_URL= 'ws://localhost:8080'


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
    longigude: number;
  };
}

export interface UserProximity {
  type: "user_enetered_proxmity";
  userId: string;
  location: {
    latitude: number;
    longitude: number;
  };
}
