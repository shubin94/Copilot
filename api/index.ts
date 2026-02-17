import serverlessHttp from "serverless-http"
import { app } from "../server/app"
import { registerRoutes } from "../server/routes"

let handler: any
let initialized = false

export default async function api(req: any, res: any) {
  if (!initialized) {
    await registerRoutes(app)
    handler = serverlessHttp(app)
    initialized = true
  }
  return handler(req, res)
}
