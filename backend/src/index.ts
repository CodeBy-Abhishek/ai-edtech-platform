import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import courseRoutes from './routes/courseRoutes';
import labRoutes from './routes/labRoutes';
import assessmentRoutes from './routes/assessmentRoutes';
import certificateRoutes from './routes/certificateRoutes';
import instructorRoutes from './routes/instructorRoutes';
import paymentRoutes from './routes/paymentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import securityRoutes from './routes/securityRoutes';
import userRoutes from './routes/userRoutes';
import noteRoutes from './routes/noteRoutes';
import assignmentRoutes from './routes/assignmentRoutes';

import adminRoutes from './routes/adminRoutes';
import { handleStripeWebhook } from './controllers/webhookController';
import { simulateWebhook } from './controllers/testController';

dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import { SocketService } from './socket/socketService';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Initialize Socket Service
new SocketService(io);

// Webhook Route - Must be before express.json()
app.post('/api/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/admin', adminRoutes);

app.post('/api/test/simulate-webhook', simulateWebhook);

app.get('/', (req: Request, res: Response) => {
    res.send('EdTech Platform Backend API is running...');
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.io initialized`);
});

