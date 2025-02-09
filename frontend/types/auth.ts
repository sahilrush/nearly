import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().min(3, "username must be atleast 3 character"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "password must be atleast 6 character"),
});

export const signinSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "password must be atleast 6 character"),
});


export type SignupData = z.infer<typeof signupSchema>;
export type SigninData = z.infer<typeof signinSchema>; 

export interface AuthResponse{
  token:string; 
  user:{
    id:string;
    username:string;
    email:string; 
  },
  message:string;
}