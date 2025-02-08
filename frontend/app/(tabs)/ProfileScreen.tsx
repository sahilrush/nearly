import { StyleSheet,View,Text } from "react-native"


export default function Profile(){
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profiles</Text>
    </View>
  )
}


const styles = StyleSheet.create({
   container:{ flex:1, justifyContent:"center", alignItems:"center"},
   text:{ fontSize:24, fontWeight:"bold"}
})