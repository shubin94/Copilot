# Production Deployment Checklist

## ✅ Security Fixes Applied

- [x] Added security comments to auth endpoints (admin credentials are DB-driven only)
- [x] Enhanced Content Security Policy (CSP) headers for production
- [x] Added HSTS headers for HTTPS enforcement in production
- [x] Improved error handling to prevent stack trace leaks in production
- [x] Rate limiting already configured for auth endpoints
- [x] Password redaction in logs already implemented
- [x] Fixed npm security vulnerabilities (ran `npm audit fix`)

## 🔒 Pre-Deployment Security Requirements

### Environment Variables (Required)
Create a `.env` file with these production values:

```bash
NODE_ENV=production

# Database (Required)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Session Security (Required - generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=<GENERATE_STRONG_SECRET>
SESSION_USE_MEMORY=false  # Use database sessions in production

# CSRF Protection (Required)
CSRF_ALLOWED_ORIGINS=https://yourdomain.com

# Sentry Error Tracking (Recommended)
SENTRY_DSN=https://your-sentry-dsn

# SSL/TLS (Required for production DB)
DB_ALLOW_INSECURE_DEV=false
```

### Database Secrets (Stored in `app_secrets` table)
Run this command to seed secrets to database:
```bash
npm run seed-app-secrets
```

Or manually add via Admin Panel → App Secrets:
- Google OAuth credentials
- Supabase URL and service role key
- Email provider credentials (SendPulse/Resend)
- PayPal/Stripe gateway credentials
- Base URL (your production domain)

### SSL/HTTPS Setup
1. Obtain SSL certificate (Let's Encrypt, Cloudflare, etc.)
2. Configure reverse proxy (nginx/Apache) or use platform SSL (Vercel, Railway, etc.)
3. Ensure `SESSION_SECRET` is set for secure cookies
4. Set `CSRF_ALLOWED_ORIGINS` to your production domain

### Database Migration
1. Ensure all migrations are applied:
```bash
# Check database schema
npm run db:audit
```

2. Verify critical tables exist:
   - users (with google_id column)
   - detectives
   - services
   - session
   - app_secrets
   - app_policies

### Create Admin User
```bash
npm run reset-auth
# Save the generated credentials securely
```

## 🚀 Deployment Steps

1. **Set Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in all production values
   - Never commit `.env` to git

2. **Build Application**
```bash
npm install --production
npm run build
```

3. **Run Database Migrations**
```bash
# Apply any pending migrations
# (Add your migration command here)
```

4. **Start Application**
```bash
npm start
# Or use PM2: pm2 start ecosystem.config.cjs
```

5. **Verify Deployment**
   - Check health endpoint: `GET /api/health`
   - Test login with admin credentials
   - Verify HTTPS is working
   - Check error logs for issues

## 🔍 Post-Deployment Verification

### Security Checks
- [ ] HTTPS is enforced (no HTTP access)
- [ ] CSP headers are active (`Content-Security-Policy` header present)
- [ ] HSTS header is set (`Strict-Transport-Security` header present)
- [ ] Rate limiting is working on `/api/auth/*` endpoints
- [ ] CSRF protection is active (try POST without CSRF token - should fail)
- [ ] Error messages don't leak stack traces or sensitive data

### Functional Checks
- [ ] Admin can log in successfully
- [ ] User registration works
- [ ] Detective profiles load correctly
- [ ] Services are visible
- [ ] Payment gateways are configured
- [ ] Email sending works (test password reset)

### Performance Checks
- [ ] Database connection pool is sized correctly (check logs)
- [ ] Static assets are cached properly
- [ ] API response times are acceptable
- [ ] No memory leaks (monitor for 24 hours)

## 📊 Monitoring & Maintenance

### Set Up Monitoring
1. **Error Tracking**: Configure Sentry (set `SENTRY_DSN`)
2. **Uptime Monitoring**: Use UptimeRobot, Pingdom, or similar
3. **Server Monitoring**: CPU, memory, disk usage
4. **Database Monitoring**: Connection pool, query performance

### Regular Maintenance
- Daily: Check error logs
- Weekly: Review security audit (`npm audit`)
- Monthly: Update dependencies (`npm update`)
- Quarterly: Review and rotate secrets

### Backup Strategy
1. **Database Backups**: Daily automated backups
2. **File Storage**: Backup Supabase storage bucket
3. **Configuration**: Backup environment variables (encrypted)
4. **Test Restores**: Monthly restore test

## 🚨 Known Limitations

### npm Audit Warnings
- `esbuild` and `tar` vulnerabilities are in dev dependencies
- These don't affect production runtime
- Monitor for updates and upgrade when stable versions available

### Production Configuration Notes
- CSP is configured for production only (disabled in dev for flexibility)
- HSTS preload is enabled (requires HTTPS from first visit)
- Session cookies require HTTPS in production
- CSRF requires same-origin or configured origins

## 📞 Emergency Procedures

### If Admin Account Is Compromised
```bash
npm run reset-auth  # Creates new admin with random credentials
```

### If Database Connection Fails
1. Check `DATABASE_URL` environment variable
2. Verify database server is running
3. Check connection pool limits
4. Review database logs

### If Application Crashes
1. Check server logs for errors
2. Verify all environment variables are set
3. Check database connectivity
4. Review Sentry error reports (if configured)
5. Restart with: `npm start` or `pm2 restart all`

## 📝 Additional Resources

- Security Best Practices: See `SECURITY_AUDIT_REPORT.md`
- Authentication Guide: See `AUTH_SECURITY_REVIEW.md`
- Database Schema: See `CMS_DATABASE_SCHEMA_VERIFICATION.md`
- API Documentation: See `COMPLETE_DOCUMENTATION_INDEX.md`

---

**Last Updated**: February 1, 2026
**Status**: Ready for production deployment after completing checklist
