import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoicePaymentLinksRouter from "./invoice-payment-links";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoicePaymentLinksRouter);
router.use(aiRouter);

export default router;
