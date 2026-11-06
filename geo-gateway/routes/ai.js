import express from 'express';
import proxy from 'express-http-proxy';
import cors from 'cors';
import { corsOptionsDelegate } from '../middleware/corsMiddleware.js';
import { tokenValidationMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(cors(corsOptionsDelegate));
router.use(tokenValidationMiddleware);


/**
 * @route ALL /ai/*
 * @description Serves as a gateway proxy for the AI Service.
 * Forwards all requests (GET, POST, PUT, DELETE, etc.) to the upstream AI Service configured in the environment.
 * The proxy handles URL forwarding, preserving the path and query parameters.
 * Authorization header is only sent if AI_SERVICE_TOKEN is set in the environment.
 */

router.use('/', proxy(process.env.AI_SERVICE_URL, {
    timeout: 300000,
    proxyReqPathResolver: (req) => {
        const targetPath = new URL(process.env.AI_SERVICE_URL).pathname;
        return (targetPath.endsWith('/') ? targetPath.slice(0, -1) : targetPath) + req.url;
    },
    proxyReqOptDecorator: (proxyReqOpts) => {
        // Only attach token if AI_SERVICE_TOKEN is set; remove header completely if empty
        if (process.env.AI_SERVICE_TOKEN) {
            proxyReqOpts.headers['Authorization'] = `token ${process.env.AI_SERVICE_TOKEN}`;
        } else {
            delete proxyReqOpts.headers['authorization'];
            delete proxyReqOpts.headers['Authorization'];
        }
        proxyReqOpts.timeout = 300000;
        return proxyReqOpts;
    },
    proxyErrorHandler: (err, res, next) => {
        console.error('AI Proxy error:', err);
        console.error('AI Proxy error details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        res.locals.errorMessage = err.stack;
        res.status(502).json({
            error: 'Bad Gateway',
            message: 'Failed to communicate with AI service',
            details: err.message
        });
    }
}));

export default router;
