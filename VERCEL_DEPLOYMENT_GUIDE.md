## 🐛 Troubleshooting

### Issue: Still Blank After Redeploy

**Possible Causes:**

1. **Build Failed**
   - Go to Vercel → Deployments → Click latest deployment
   - Check build logs for errors
   - Look for errors in "Build" section

2. **JavaScript Not Loading**
   - Check Network tab for 404 errors on `/assets/*.js` files
   - If files are 404, build output directory might be wrong
   - Ensure `vercel.json` has `"outputDirectory": "dist/public"`

3. **API Proxy Not Working**
   - Check Render logs: should see API requests coming through
   - If no requests in Render logs, Vercel proxy isn't working
   - Verify `vercel.json` is committed and deployed
