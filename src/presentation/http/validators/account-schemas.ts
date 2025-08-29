import { z } from "zod"

export const AccountSettingsInput = z.object({
  domain: z.string().min(4, "Domínio inválido").regex(
    /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/,
    "Formato de domínio inválido"
  ),
})