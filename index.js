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

app.post('/api/webhooks/:webhookId/:webhookToken', webhookRateLimiter, async (req, res) => {
    const discordWebhookUrl = `https://discord.com/api/webhooks/${req.params.webhookId}/${req.params.webhookToken}`;

    try {
        const response = await axios.post(discordWebhookUrl, req.body);
        res.status(200).send('Webhook enviado com sucesso!');
    } catch (error) {
        console.error('Erro ao enviar o webhook:', error.message);
        res.status(500).send('Erro ao enviar o webhook.');
    }
});

app.listen(port, () => {
    console.log(`Webhook proxy rodando na porta ${port}`);
});
