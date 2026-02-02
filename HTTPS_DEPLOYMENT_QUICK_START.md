# HTTPS Deployment Quick Reference

## ✅ Application Status: Production-Ready

Your application is hardened and ready for HTTPS deployment.

---

## Required Environment Variables

**Copy and set these in your hosting provider's environment settings:**

```bash
# CRITICAL - No defaults in production
BASE_URL=https://your-domain.com
CSRF_ALLOWED_ORIGINS=https://your-domain.com
SESSION_SECRET=<generate-with-openssl-or-1password>
DATABASE_URL=<your-postgresql-connection>

# Optional - if Google OAuth enabled
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
```

### Generate SESSION_SECRET
```bash
# Using openssl:
openssl rand -hex 32

# Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Hosting Platform Examples

### Render.com (Recommended)
1. Create project and connect GitHub repo
2. Set environment variables in Dashboard → Environment
3. Set Build Command: `npm install && npm run build`
4. Set Start Command: `npm start`
5. Deploy
6. Render automatically provides HTTPS ✅

### Railway.app
1. New Project → GitHub repo
2. Set variables in Variables tab
3. Railway automatically detects `package.json`
4. Deploy
5. Railway automatically provides HTTPS ✅

### Vercel (Frontend Only)
- Deploy Express backend separately to Render/Railway
- Set `BASE_URL` to backend domain
- Deploy frontend to Vercel (automatically HTTPS)

---

## Pre-Deployment Checklist

- [ ] PostgreSQL database created and accessible
- [ ] `SESSION_SECRET` generated (32+ bytes)
- [ ] `BASE_URL` set to final deployment domain
- [ ] `CSRF_ALLOWED_ORIGINS` set to deployment domain
- [ ] `DATABASE_URL` configured correctly
- [ ] If using Google OAuth:
  - [ ] OAuth credentials created in Google Console
  - [ ] Authorized redirect URI: `https://your-domain.com/api/auth/google/callback`
  - [ ] Client ID and secret set in environment

---

## After Deployment: Quick Tests

### Test 1: HTTPS Redirect
```bash
curl -I http://your-domain.com
# Should redirect to https://your-domain.com
```

### Test 2: Security Headers
```bash
curl -I https://your-domain.com
# Should include:
# - Strict-Transport-Security
# - Content-Security-Policy
# - X-Frame-Options: DENY
```

### Test 3: Login Flow
1. Visit `https://your-domain.com/login`
2. Enter credentials
3. Should create secure session cookie

### Test 4: CSRF Protection (Advanced)
```bash
# This should fail with 403 Forbidden
curl -X POST https://your-domain.com/api/admin \
  -H "Origin: https://attacker.com" \
  -H "X-CSRF-Token: invalid"
```

---

## Troubleshooting

### Issue: "Cookie is invalid"
**Solution**: The `secure` flag requires HTTPS. Ensure:
- Deployment has valid HTTPS certificate
- Hosting provider has trust proxy configured
- `app.set("trust proxy", 1)` is in server/app.ts ✅

### Issue: "CSRF validation failed"
**Solution**: Ensure `CSRF_ALLOWED_ORIGINS` env var is set:
```bash
CSRF_ALLOWED_ORIGINS=https://your-actual-deployed-domain.com
```

### Issue: "OAuth redirect URI mismatch"
**Solution**: Ensure Google Console redirect URI exactly matches:
```
https://your-domain.com/api/auth/google/callback
```
Must be registered in Google Console OAuth settings.

### Issue: "Can't connect to database"
**Solution**: Verify `DATABASE_URL`:
- [ ] PostgreSQL server is running
- [ ] Connection string is correct format
- [ ] Firewall allows app to database connection
- [ ] Database user has required permissions

---

## Key Security Features Enabled

✅ HTTPS-only cookies (automatic in production)  
✅ CSRF protection (strict origin validation)  
✅ Rate limiting (10 auth attempts per 15 min)  
✅ Secure sessions (database-backed, cryptographic tokens)  
✅ HSTS (forces HTTPS for 1 year)  
✅ CSP headers (restricts resource loading)  
✅ XSS protection (HttpOnly cookies)  

---

## Support

For issues or questions:
1. Check [HTTPS_PRODUCTION_AUDIT.md](HTTPS_PRODUCTION_AUDIT.md) for detailed information
2. Review hosting provider documentation
3. Check application logs for errors

---

**Last Updated**: Current Session  
**Status**: ✅ Deployment Ready
