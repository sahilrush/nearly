import {z} from "zod"

export const signupSchema = z.object({
  email:z.string().email(),
  password:z.string().min(6,"Password must be least 6 Characters")
})

export const signinSchenma = z.object({
  email:z.string().email(),
  password:z.string()
})
