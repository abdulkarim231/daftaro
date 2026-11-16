import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoicePaymentLinksRouter from "./invoice-payment-links";

const router: IRouter = Router();

router.use(healthRouter);
router.use(invoicePaymentLinksRouter);

export default router;
