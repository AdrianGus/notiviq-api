import type { Request, Response } from "express"
import { MongoAccountRepository } from "../../../infra/db/mongoose/repositories/mongo-account-repository.js"
import { AccountSettingsInput } from "../validators/account-schemas.js"
import { getAuth } from "@clerk/express"
import { publicAccountSerializer } from "../serializers/account-serializer.js"

const accountRepository = MongoAccountRepository()

export class AccountController {
  static async getByContext(req: Request, res: Response) {
    try {
      const { userId } = getAuth(req)

      if (!userId) return res.status(404).json({ error: "Account not found" })

      const account = await accountRepository.findByExternalId(
        'clerk',
        userId
      )

      if (!account) return res.status(404).json({ error: "Account not found" })

      return res.json(publicAccountSerializer(account))
    } catch (err: any) {
      console.error("[AccountController.get]", err)
      return res.status(500).json({ error: "Internal Server Error" })
    }
  }

  static async updateByContext(req: Request, res: Response) {
    try {
      const { userId } = getAuth(req)

      if (!userId) return res.status(404).json({ error: "Account not found" })

      const parsed = AccountSettingsInput.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      const account = await accountRepository.findByExternalId(
        'clerk',
        userId
      )

      if (!account) return res.status(404).json({ error: "Account not found" })

      const updated = await accountRepository.update(account.id, {
        settings: { domain: parsed.data.domain },
      })

      return res.json(publicAccountSerializer(updated ? updated : account))
    } catch (err: any) {
      console.error("[AccountController.update]", err)
      return res.status(500).json({ error: "Internal Server Error" })
    }
  }
}
