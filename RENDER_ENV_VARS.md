# Render Environment Variables Configuration

Set these environment variables in your Render dashboard (Environment tab):

## Database Configuration
```
DATABASE_URL=postgresql://postgres:supabasepassword27@db.obswbfdhbzldydpfyfxj.supabase.co:5432/postgres
DB_PASSWORD=supabasepassword27
```

## Redis Configuration  
```
REDIS_URL=redis://default:Ae_FAAIncDFiZmJmMzE0MjhjNmQ0MjQ5YjQ3MmQwNGEyOWY3ZDYyZHAxNjEzODE@open-fawn-61381.upstash.io:6379
```

## Application Configuration
```
NODE_ENV=production
PORT=5000
JWT_SECRET=1KqB9tZOnT3mG7A8XfUudRHoU2Q9Zr0nD9X0L3Bt4vNcYZRnNPS7m4PjZ3gZznhX
```

## CORS Configuration
```
FRONTEND_URL=https://27send-chess.vercel.app
CORS_ORIGINS=https://27send-chess.vercel.app
```

## Rate Limiting
```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

---

## Instructions:
1. Go to your Render service dashboard
2. Click on "Environment" tab
3. Add each variable above (one per line, format: KEY=VALUE)
4. Click "Save Changes"
5. Render will automatically redeploy your service