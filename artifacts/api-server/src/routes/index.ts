import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoicePaymentLinksRouter from "./invoice-payment-links";
import aiRouter from "./ai";
import invoiceScannerRouter from "./invoice-scanner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoicePaymentLinksRouter);
router.use(aiRouter);
router.use(invoiceScannerRouter);

export default router;
