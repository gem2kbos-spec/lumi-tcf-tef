# Render Deployment: Lumi TCF/TEF

This project can run as one Render Web Service. Render will give it a stable URL like:

```text
https://lumi-tcf-tef.onrender.com
```

## Create the service

1. Push this repository to GitHub.
2. Open Render.
3. Create a new Web Service from the GitHub repository.
4. Use these settings:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /api/health
```

## Environment variables

Add these in Render:

```text
DEEPSEEK_API_KEY=your_real_key
DEEPSEEK_MODEL=deepseek-v4-flash
NODE_VERSION=24
```

Do not commit the real DeepSeek key.

## Data persistence

The free Render plan gives a stable public URL, but local files created while the app runs are not guaranteed to survive restarts or redeploys.

For durable practice history, vocabulary notebook, and knowledge journal, use a paid Render service with a persistent disk mounted at:

```text
/opt/render/project/src/server/data
```

The imported question bank is committed in `server/imports/questions.json`, so the 700-question bank deploys with the app.
