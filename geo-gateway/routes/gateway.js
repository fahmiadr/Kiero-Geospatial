import express from 'express';
import proxy from 'express-http-proxy';
import cors from 'cors';
import { tokenValidationMiddleware } from '../middleware/authMiddleware.js';
import { corsOptionsDelegate } from '../middleware/corsMiddleware.js';

const router = express.Router();

router.use(cors(corsOptionsDelegate));
router.use(tokenValidationMiddleware);

/**
 * @route ALL /api/*
 * @description Serves as the main gateway proxy for the internal Resource Server.
 * Forwards all authenticated requests to the downstream service configured in RESOURCE_SERVER_URL.
 * This route is protected by JWT validation and CORS policies.
 */
router.use('/', proxy(process.env.RESOURCE_SERVER_URL, {
    timeout: 30000,
    proxyReqPathResolver: (req) => {
        const targetPath = new URL(process.env.RESOURCE_SERVER_URL).pathname;
        return (targetPath.endsWith('/') ? targetPath.slice(0, -1) : targetPath) + req.url;
    },
    proxyReqOptDecorator: (proxyReqOpts) => {
        proxyReqOpts.timeout = 30000;
        return proxyReqOpts;
    },
  proxyErrorHandler: (err, res, next) => {
    console.error('Proxy error:', err);
    res.locals.errorMessage = err.stack;
    res.status(502).json({ error: 'Bad Gateway', message: 'Could not connect to the internal service.', details: err.message });
  }
}));

export default router;
