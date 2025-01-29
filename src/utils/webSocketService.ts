import { json } from "stream/consumers";
import  WebSocket from "ws";

class WebSocketService {
  private static instance: WebSocketService
  private wss:WebSocket.Server
  private clients:Map<string, WebSocket> = new Map();


  private constructor(){
    this.wss = new WebSocket.Server({port :8000})
  }

  public static getInstance(): WebSocketService{
    if(!WebSocketService.instance) {
      WebSocketService.instance =  new WebSocketService();
    }
    return WebSocketService.instance
  }

 private setupListeners(){
  this.wss.on("connected", (ws) => {
    console.log("client connected");

    ws.on("message", (message) => this.handleMessage(ws,message))
    ws.on("close", () => console.log("Client disconnected"))
  })
 }

 private async handleMessage(ws:WebSocket, message:WebSocket.RawData){
  try{
    const data = JSON.parse(message.toString());
    
    if(data.type == "update_location"){
      const {userId,latitude,longitude} = data;
      
      //store the ws connection for this user
       this.clients.set(userId,ws)

       //process locaiton update and check for the nearby users
       const nearbyUsers = await this.findNearbyUsers(latitude,longitude, 10);


       //notify nearby user
       nearbyUsers.forEach((user) => {
        const client = this.clients.get(user.userId);
        if(client) {
          client.send(JSON.stringify({type:"nearbyUser", userId, latitude,}))
        }

       });
    }
  }catch(err) {
    console.error("Error processing the message", err)
  }
 }


 private async findNearbyUsers(lat:number, lon:number, radius:number) {
        return []
 }
}

export default WebSocketService.getInstance();