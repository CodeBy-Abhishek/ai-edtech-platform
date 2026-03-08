import { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../index';
import { createCheckoutSession } from '../services/stripeService';
import { v4 as uuidv4 } from 'uuid';

// This would typically come from an auth middleware
interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
    };
}

export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        const { courseId, couponCode } = req.body;
        const userId = req.user?.userId;
        const userEmail = req.user?.email || 'customer@example.com';

        if (!userId || !courseId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
             return res.status(404).json({ message: 'Course not found' });
        }

        let finalAmount = course.price;
        let appliedCouponId = null;

        if (couponCode) {
            const coupon = await prisma.coupon.findUnique({
                where: { code: couponCode, isActive: true }
            });

            if (coupon && (!coupon.expiresAt || coupon.expiresAt > new Date()) && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
                if (coupon.type === 'PERCENTAGE') {
                    finalAmount = course.price - (course.price * coupon.discount / 100);
                } else {
                    finalAmount = Math.max(0, course.price - coupon.discount);
                }
                appliedCouponId = coupon.id;
            }
        }

        // Mocking Payment Gateway Order Creation (e.g. Stripe PaymentIntent or Razorpay Order)
        const orderId = `ORDER-${uuidv4().substring(0, 8).toUpperCase()}`;

        const payment = await prisma.payment.create({
            data: {
                orderId,
                userId,
                courseId,
                amount: finalAmount,
                currency: 'INR',
                status: 'PENDING',
                couponId: appliedCouponId
            }
        });

        res.status(201).json({
            orderId: payment.orderId,
            amount: payment.amount,
            currency: payment.currency
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating order', error });
    }
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
    try {
        const { orderId, paymentId, status } = req.body; // In real app, this comes from webhook or secure callback

        const payment = await prisma.payment.findUnique({
            where: { orderId },
            include: { course: true }
        });

        if (!payment) return res.status(404).json({ message: 'Order not found' });

        if (status === 'SUCCESS') {
            // 1. Update Payment Status
            await prisma.payment.update({
                where: { orderId },
                data: { status: 'SUCCESS', paymentId }
            });

            // 2. Create Enrollment
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year access by default

            await prisma.enrollment.upsert({
                where: { userId_courseId: { userId: payment.userId, courseId: payment.courseId } },
                update: { status: 'ACTIVE', expiresAt },
                create: {
                    userId: payment.userId,
                    courseId: payment.courseId,
                    status: 'ACTIVE',
                    expiresAt
                }
            });

            // 3. Increment Coupon usage if applied
            if (payment.couponId) {
                await prisma.coupon.update({
                    where: { id: payment.couponId },
                    data: { usedCount: { increment: 1 } }
                });
            }

            return res.json({ message: 'Payment verified and enrollment active.' });
        } else {
            await prisma.payment.update({
                where: { orderId },
                data: { status: 'FAILED' }
            });
            return res.status(400).json({ message: 'Payment failed.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error verifying payment', error });
    }
};

export const createCoupon = async (req: AuthRequest, res: Response) => {
    try {
        const { code, discount, type, expiresAt, maxUses } = req.body;
        const coupon = await prisma.coupon.create({
            data: { code, discount, type, expiresAt: expiresAt ? new Date(expiresAt) : null, maxUses }
        });
        res.status(201).json(coupon);
    } catch (error) {
        res.status(500).json({ message: 'Error creating coupon', error });
    }
};
