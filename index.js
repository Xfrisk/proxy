const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const Queue = require('bull');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.set('trust proxy', 1);

const webhookQueue = new Queue('webhookQueue', 'redis://127.0.0.1:6379');

const webhookRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 25,
    message: { error: 'Too many requests. Please try again later.' },
    statusCode: 429,
    handler: async (req, res, next, options) => {
        await webhookQueue.add({
            webhookId: req.params.webhookId,
            webhookToken: req.params.webhookToken,
            body: req.body
        });
        res.status(429).send(options.message);
    }
});

// Processa mensagens na fila
webhookQueue.process(async (job) => {
    const { webhookId, webhookToken, body } = job.data;
    const discordWebhookUrl = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}`;

    try {
        await axios.post(discordWebhookUrl, body);
        console.log('Webhook enviado com sucesso!');
    } catch (error) {
        console.error('Erro ao enviar o webhook:', error.message);
        
    }
});

app.post('/api/webhooks/:webhookId/:webhookToken', webhookRateLimiter, (req, res) => {
    res.status(200).send('Webhook enfileirado com sucesso!');
});

app.listen(port, () => {
    console.log(`Webhook proxy rodando na porta ${port}`);
});
