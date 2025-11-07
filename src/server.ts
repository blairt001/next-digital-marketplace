import express from "express";
import { getPayloadClient } from "./get-payload";
import { nextApp, nextHandler } from "./next-utils";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./trpc";
import { inferAsyncReturnType } from "@trpc/server";
import bodyParser from "body-parser";
import { IncomingMessage } from "http";
import { stripeWebhookHandler } from "./webhooks";
import nextBuild from "next/dist/build";
import path from "path";
import { PayloadRequest } from "payload/types";
import { parse } from "url";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({
  req,
  res,
});

export type ExpressContext = inferAsyncReturnType<typeof createContext>;

export type WebhookRequest = IncomingMessage & {
  rawBody: Buffer;
};

const start = async () => {
  const webhookMiddleware = bodyParser.json({
    verify: (req: WebhookRequest, _, buffer) => {
      req.rawBody = buffer;
    },
  });

  app.post("/api/webhooks/stripe", webhookMiddleware, stripeWebhookHandler);

  let payload: any;

  try {
    payload = await getPayloadClient({
      initOptions: {
        express: app,
        onInit: async (cms) => {
          cms.logger.info(`Admin URL: ${cms.getAdminURL()}`);
        },
      },
    });
  } catch (err) {
    // If Payload fails to initialize (for example in dev when DB adapter
    // versions mismatch), log a warning and provide a minimal mock so the
    // Next.js app can still run. Features depending on Payload will be
    // non-functional until a proper config/key is provided.
    // eslint-disable-next-line no-console
    console.warn(
      "Payload failed to initialize:",
      (err as any)?.message || err
    );

    payload = {
      logger: { info: () => {}, error: () => {} },
      authenticate: ((req: any, res: any, next: any) => next) as any,
      find: async () => ({ docs: [] }),
      update: async () => ({}),
      create: async () => ({}),
    };
  }

  if (process.env.NEXT_BUILD) {
    app.listen(PORT, async () => {
      payload.logger.info("Next.js is building for production");

      // @ts-expect-error
      await nextBuild(path.join(__dirname, "../"));

      process.exit();
    });

    return;
  }

  const cartRouter = express.Router();

  // payload.authenticate's signature isn't typed as an Express RequestHandler
  // so cast to satisfy TypeScript's expectations here.
  cartRouter.use(payload.authenticate as unknown as express.RequestHandler);

  cartRouter.get("/", (req, res) => {
    const request = req as PayloadRequest;

    if (!request.user) return res.redirect("/sign-in?origin=cart");

    const parsedUrl = parse(req.url, true);
    const { query } = parsedUrl;

    return nextApp.render(req, res, "/cart", query);
  });

  app.use("/cart", cartRouter);
  app.use(
    "/api/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use((req, res) => nextHandler(req, res));

  nextApp.prepare().then(() => {
    payload.logger.info("Next.js started");

    app.listen(PORT, async () => {
      payload.logger.info(
        `Next.js App URL: ${process.env.NEXT_PUBLIC_SERVER_URL}`
      );
    });
  });
};

start();
