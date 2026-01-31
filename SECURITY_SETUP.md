# Security Setup Guide

This guide covers the steps to rotate the API key and configure environment variables securely.

---

## 🔐 New API Key

Your new API key has been generated:

```
11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99
```

**⚠️ IMPORTANT:** Delete this file after completing the setup steps below.

---

## 📋 Setup Steps

### 1. Backend Setup (Railway)

**Update the backend environment variable:**

1. Go to Railway dashboard: https://railway.app/dashboard
2. Select your `lapwise-backend` project
3. Go to **Variables** tab
4. Update or add:
   ```
   LAPWISE_API_KEY=11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99
   ```
5. Railway will automatically redeploy with the new key

**For local development:**

1. Update your `backend/.env` file:
   ```bash
   LAPWISE_API_KEY=11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99
   ```

---

### 2. Frontend Setup (Netlify)

**Update Netlify environment variables:**

1. Go to Netlify dashboard: https://app.netlify.com/
2. Select your `lapwise` site
3. Go to **Site settings** → **Environment variables**
4. Add or update these variables:

   **For Production (main branch):**
   ```
   NEXT_PUBLIC_API_URL=https://api.lapwise.dev
   NEXT_PUBLIC_API_KEY=11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99
   ```

   **For Branch Deploys (optional):**
   ```
   NEXT_PUBLIC_API_URL=https://lapwisedev-dev.up.railway.app
   NEXT_PUBLIC_API_KEY=11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99
   ```

5. Trigger a new deploy or wait for the next automatic deploy

**For local development:**

1. Create `frontend/.env.local` (if it doesn't exist):
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_API_KEY=11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99
   ```

---

### 3. Verify the Setup

**Test backend:**
```bash
curl -H "X-API-Key: 11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99" \
  https://api.lapwise.dev/api/results/2024
```

**Test frontend:**
1. Visit https://lapwise.dev
2. Open browser DevTools → Network tab
3. Check that API requests include the new key in headers
4. Verify no 403 errors

**Test local development:**
```bash
# Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Frontend (in another terminal)
cd frontend
npm run dev

# Verify script
cd backend
API_KEY=11b5919f6bba655af654c6c505c20968fd3011d0262ce8d409a4d3b7aba74c99 \
  python scripts/verify_endpoints.py
```

---

## 🧹 Cleanup

After completing all steps above:

1. **Delete this file:**
   ```bash
   rm SECURITY_SETUP.md
   ```

2. **Verify the old key is gone from Git history** (optional):
   ```bash
   git log -p | grep "754b5a8e5c6c17f92026f9fedbe15bf58fbb0af80c3706098d0da7701327ad26"
   ```

   Note: The old key will remain in Git history forever. This is why we rotated it.

3. **Commit the changes:**
   ```bash
   git add .
   git commit -m "Remove hardcoded API keys and update security configuration"
   git push origin dev
   ```

---

## 📝 Best Practices Going Forward

✅ **DO:**
- Keep API keys in environment variables only
- Use `.env` files for local development (never commit them)
- Use platform UI (Netlify/Railway) for production secrets
- Rotate keys if they're ever exposed publicly

❌ **DON'T:**
- Commit API keys to Git (netlify.toml, .env, etc.)
- Hardcode secrets in source code
- Use the same key across dev/staging/prod (optional but recommended)

---

## 🆘 Troubleshooting

**403 Forbidden errors:**
- Check that `LAPWISE_API_KEY` matches `NEXT_PUBLIC_API_KEY`
- Verify Railway/Netlify environment variables are set correctly
- Check Railway deployment logs for errors

**Local development not working:**
- Ensure `backend/.env` has `LAPWISE_API_KEY` set
- Ensure `frontend/.env.local` has `NEXT_PUBLIC_API_KEY` set
- Restart both dev servers after changing env files

**Old key still being used:**
- Clear browser cache
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
- Verify Netlify deployed after env variable change
