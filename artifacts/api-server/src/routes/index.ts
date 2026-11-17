import { Router, type IRouter } from "express";
import healthRouter from "./health.ts";
import invoicePaymentLinksRouter from "./invoice-payment-links.ts";
import aiRouter from "./ai.ts";
import invoiceScannerRouter from "./invoice-scanner.ts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoicePaymentLinksRouter);
router.use(aiRouter);
router.use(invoiceScannerRouter);

export default router;
