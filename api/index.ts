import express from "express"
import serverlessHttp from "serverless-http"
import { registerRoutes } from "../server/routes"

let handler: any

export default async function api(req: any, res: any) {
  if (!handler) {
    const app = express()
    await registerRoutes(app)
    handler = serverlessHttp(app)
  }
  return handler(req, res)
}
