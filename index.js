const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.set('trust proxy', 1);

const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 25,
    message: { error: 'Too many requests. Please try again later.' },
    statusCode: 429,
});

const messageQueue = [];
let processingQueue = false;

function calculateDelay(remainingRequests) {
    const totalRequests = 25;
    const delayMultiplier = 1000;
    const delay = (totalRequests - remainingRequests) * delayMultiplier;
    return Math.min(delay, 60000);
}

async function processQueue() {
    if (processingQueue || messageQueue.length === 0) return;

    processingQueue = true;
    const { discordWebhookUrl, body, res, rateLimitRemaining } = messageQueue.shift();

    const delay = calculateDelay(rateLimitRemaining);
    await new Promise(resolve => setTimeout(resolve, delay));

    axios.post(discordWebhookUrl, body)
        .then(() => {
            res.status(200).send('Webhook sent successfully!');
        })
        .catch((error) => {
            console.error('Error sending webhook:', error.message);
            res.status(500).send('Error sending webhook.');
        })
        .finally(() => {
            processingQueue = false;
            processQueue();
        });
}

function rateLimitMiddleware(req, res, next) {
    webhookRateLimiter(req, res, (err, remaining) => {
        if (err) {
            const discordWebhookUrl = `https://discord.com/api/webhooks/${req.params.webhookId}/${req.params.webhookToken}`;
            messageQueue.push({ discordWebhookUrl, body: req.body, res, rateLimitRemaining: remaining });
            res.status(200).send('Too many requests. Your message is queued.');
        } else {
            next();
        }
    });
}

app.post('/api/webhooks/:webhookId/:webhookToken', rateLimitMiddleware, async (req, res) => {
    const discordWebhookUrl = `https://discord.com/api/webhooks/${req.params.webhookId}/${req.params.webhookToken}`;

    try {
        await axios.post(discordWebhookUrl, req.body);
        res.status(200).send('Webhook sent successfully!');
    } catch (error) {
        console.error('Error sending webhook:', error.message);
        res.status(500).send('Error sending webhook.');
    }
});

setInterval(processQueue, 1000);

app.listen(port, () => {
    console.log(`Webhook proxy running on port ${port}`);
});
