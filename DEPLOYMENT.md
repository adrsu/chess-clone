# 🚀 Production Deployment Guide

This guide will help you deploy your Chess.com clone to production using Supabase, Railway, and Vercel.

## 📋 Prerequisites

- [Supabase](https://supabase.com) account
- [Render](https://render.com) account (for backend)
- [Vercel](https://vercel.com) account (for frontend)
- [Upstash](https://upstash.com) account (for Redis)

## 🗄️ Step 1: Set up Supabase Database

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and fill project details
4. Select region closest to your users
5. Wait for project to be ready

### 1.2 Run Database Migration
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of `supabase-schema.sql`
3. Run the SQL script
4. Verify tables are created in Table Editor

### 1.3 Get Database Connection String
1. Go to Settings > Database
2. Copy the connection string
3. Replace `[YOUR-PASSWORD]` with your database password

## 🔧 Step 2: Set up Redis (Upstash)

### 2.1 Create Redis Database
1. Go to [upstash.com](https://upstash.com)
2. Create account and new Redis database
3. Choose region close to your backend
4. Copy the `UPSTASH_REDIS_REST_URL`

## 🚀 Step 3: Deploy Backend (Render)

### 3.1 Create Render Web Service
1. Go to [render.com](https://render.com)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Set Root Directory to `backend`
5. Set Build Command to `npm ci && npm run build`
6. Set Start Command to `npm start`

### 3.2 Set Environment Variables
In Render dashboard, go to Environment tab and add:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres.your-project:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
REDIS_URL=rediss://default:[PASSWORD]@your-endpoint.upstash.io:6379
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters
FRONTEND_URL=https://your-chess-app.vercel.app
CORS_ORIGINS=https://your-chess-app.vercel.app
PORT=5000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### 3.3 Deploy
1. Click "Create Web Service" - Render will automatically build and deploy
2. Get your backend URL: `https://your-chess-backend.onrender.com`
3. Test health endpoint: `https://your-chess-backend.onrender.com/health`

## 🌐 Step 4: Deploy Frontend (Vercel)

### 4.1 Create Vercel Project
1. Go to [vercel.com](https://vercel.com)
2. Import Git Repository
3. Select your chess-clone repository
4. Set Root Directory to `frontend`

### 4.2 Set Environment Variables
In Vercel dashboard, go to Settings > Environment Variables:

```bash
REACT_APP_API_URL=https://your-chess-backend.onrender.com/api
REACT_APP_WS_URL=https://your-chess-backend.onrender.com
GENERATE_SOURCEMAP=false
```

### 4.3 Deploy
1. Click "Deploy"
2. Get your frontend URL: `https://your-chess-app.vercel.app`

## 🔧 Step 5: Update CORS Settings

### 5.1 Update Backend CORS
1. Go to Render dashboard
2. Update `FRONTEND_URL` and `CORS_ORIGINS` environment variables with your actual Vercel URL
3. Render will automatically redeploy

## ✅ Step 6: Testing

### 6.1 Test Registration/Login
1. Visit your frontend URL
2. Create a new account
3. Verify you can login

### 6.2 Test Matchmaking
1. Open two browser tabs/windows
2. Login with different accounts
3. Both click "Find Match"
4. Verify game starts

### 6.3 Test Game Features
- [ ] Moves work correctly
- [ ] Turn indicators work
- [ ] Draw offers work
- [ ] Resignation works
- [ ] Game timeout (10 minutes)
- [ ] Recent games display

## 🔄 Alternative Deployment Options

### Backend Alternatives
- **Railway**: Similar to Render, good for Node.js apps
- **Heroku**: Easy but not free anymore
- **Fly.io**: Great performance, Docker-based
- **DigitalOcean App Platform**: Reliable, good pricing

### Frontend Alternatives
- **Netlify**: Similar to Vercel, good free tier
- **GitHub Pages**: Free for public repos
- **Cloudflare Pages**: Fast global CDN

### Redis Alternatives
- **Railway Redis**: Add Redis service in Railway
- **Render Redis**: Coming soon (currently use external Redis)
- **Heroku Redis**: If using Heroku for backend
- **DigitalOcean Managed Redis**: For larger scale

## 🛠️ Environment Variables Summary

### Backend (.env.production)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@xxx.supabase.com:5432/postgres
REDIS_URL=rediss://default:[PASSWORD]@xxx.upstash.io:6379
JWT_SECRET=your-jwt-secret-min-32-chars
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGINS=https://your-app.vercel.app
PORT=5000
```

### Frontend (.env.production)
```bash
REACT_APP_API_URL=https://your-chess-backend.onrender.com/api
REACT_APP_WS_URL=https://your-chess-backend.onrender.com
GENERATE_SOURCEMAP=false
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `CORS_ORIGINS` matches your frontend URL exactly
   - Ensure no trailing slashes

2. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check Supabase project is active
   - Ensure IP is whitelisted (usually not needed for Supabase)

3. **Socket.IO Connection Issues**
   - Verify `REACT_APP_WS_URL` is correct
   - Check if your hosting platform supports WebSockets

4. **Redis Connection Errors**
   - Verify Redis URL format
   - Check Upstash database is active

### Logs
- **Render**: View logs in dashboard
- **Railway**: View logs in dashboard
- **Vercel**: Check function logs in dashboard
- **Supabase**: Database logs in dashboard

## 🔐 Security Checklist

- [ ] Environment variables are set correctly
- [ ] JWT secret is strong and unique
- [ ] CORS is configured properly
- [ ] Rate limiting is enabled
- [ ] Database has proper indexes
- [ ] Redis is configured with TLS

## 📈 Monitoring & Analytics

Consider adding:
- **Sentry** for error tracking
- **LogRocket** for user session replay
- **Google Analytics** for usage analytics
- **Uptime monitoring** (UptimeRobot, Pingdom)

## 💰 Cost Estimation

### Free Tier Usage
- **Supabase**: 500MB database, 2GB bandwidth
- **Render**: Free tier available, then $7/month for starter plan
- **Vercel**: Unlimited static sites
- **Upstash**: 10K commands/day free

### Scaling Costs
- Expect $10-30/month for moderate usage
- Scale Redis and database as needed
- Consider CDN for global performance

---

🎉 **Congratulations!** Your Chess.com clone is now live in production!

Visit your live application and start playing chess with users worldwide! 🏆