# GITHUB COPILOT - STRICT DEVELOPMENT RULES

## 🚫 CORE PRINCIPLES - NEVER VIOLATE

### 1. **ZERO ASSUMPTIONS POLICY**
- **NEVER** assume any part of the codebase works without verification
- **NEVER** assume dependencies are installed
- **NEVER** assume configurations are correct
- **NEVER** assume previous changes were completed
- **ALWAYS** verify before proceeding

### 2. **MANDATORY VERIFICATION CHECKLIST**
Before marking ANY task as complete, you MUST verify:

#### Frontend Verification
- [ ] All component imports are valid and exist
- [ ] All props are correctly typed and passed
- [ ] UI renders without errors in console
- [ ] State management is properly connected
- [ ] Event handlers are bound correctly
- [ ] CSS/styling is applied and visible
- [ ] Responsive design works across breakpoints
- [ ] All routes are accessible and render

#### Backend Verification
- [ ] All API endpoints are properly defined
- [ ] Database connections are established
- [ ] Models/schemas are correctly defined
- [ ] Controllers have proper error handling
- [ ] Middleware is applied in correct order
- [ ] Authentication/authorization works
- [ ] Environment variables are loaded
- [ ] All imports resolve correctly

#### API Integration Verification
- [ ] API calls use correct endpoints
- [ ] Request payloads match backend expectations
- [ ] Response handling covers all status codes
- [ ] Error handling is implemented
- [ ] Loading states are managed
- [ ] Data transformation is correct
- [ ] API contracts match frontend/backend

### 3. **ANTI-LOOP PROTOCOL**
- **NEVER** repeat the same fix more than twice
- If a solution doesn't work after 2 attempts, STOP and:
  1. Analyze the root cause
  2. Check related files for conflicts
  3. Verify dependencies and configurations
  4. Consider alternative approaches
- **DO NOT** blindly retry the same solution

### 4. **COMPLETION CRITERIA**
A task is ONLY complete when:
1. Code compiles/runs without errors
2. All tests pass (if applicable)
3. Manual testing confirms functionality
4. No console errors exist
5. All related files are updated
6. Dependencies are installed/updated
7. Documentation is updated (if needed)

---

## 📋 MANDATORY WORKFLOW

### STEP 1: ANALYSIS PHASE
Before writing ANY code:
```
[ ] Read and understand the full requirement
[ ] Identify ALL affected files (frontend, backend, config)
[ ] List all dependencies needed
[ ] Check existing code for conflicts
[ ] Identify potential edge cases
```

### STEP 2: PLANNING PHASE
```
[ ] Outline the complete solution
[ ] Identify order of operations
[ ] Plan rollback strategy if needed
[ ] Document assumptions (to be verified)
```

### STEP 3: IMPLEMENTATION PHASE
```
[ ] Make changes incrementally
[ ] Test after EACH change
[ ] Commit working code frequently
[ ] Log all modifications made
```

### STEP 4: VERIFICATION PHASE
```
[ ] Run frontend dev server - check for errors
[ ] Run backend server - check for errors
[ ] Test API endpoints using Postman/curl/browser
[ ] Check browser console for errors
[ ] Verify database operations
[ ] Test edge cases
[ ] Confirm all features work end-to-end
```

### STEP 5: CLEANUP PHASE
```
[ ] Remove debug logs
[ ] Clean up unused imports
[ ] Format code properly
[ ] Update comments/documentation
[ ] Verify no TODO items left unaddressed
```

---

## ⚠️ CRITICAL DEBUGGING RULES

### When Errors Occur:
1. **READ THE FULL ERROR MESSAGE** - don't skim
2. **CHECK THE STACK TRACE** - identify exact file and line
3. **VERIFY FILE PATHS** - ensure imports are correct
4. **CHECK DEPENDENCIES** - run `npm install` or equivalent
5. **RESTART SERVERS** - backend and frontend
6. **CLEAR CACHE** - browser and build cache
7. **CHECK ENVIRONMENT** - .env files loaded correctly

### Before Suggesting a Fix:
- Identify the ROOT CAUSE, not just symptoms
- Verify the fix doesn't break other functionality
- Consider side effects on related features
- Test the fix before presenting it

### Debugging Checklist:
```
[ ] Error message fully analyzed
[ ] Root cause identified (not guessed)
[ ] Affected files identified
[ ] Dependencies verified
[ ] Configurations checked
[ ] Related code reviewed
[ ] Fix tested locally
```

---

## 🔍 FILE MODIFICATION PROTOCOL

### Before Modifying Any File:
1. **READ THE ENTIRE FILE** - understand context
2. **CHECK DEPENDENCIES** - what else uses this file?
3. **IDENTIFY IMPACTS** - what will this change affect?
4. **BACKUP APPROACH** - how to rollback if needed?

### After Modifying Files:
1. **VERIFY SYNTAX** - no compilation errors
2. **TEST FUNCTIONALITY** - feature works as expected
3. **CHECK RELATED FILES** - nothing else broke
4. **UPDATE DEPENDENTS** - other files that import this

### File-Specific Rules:

#### Frontend Files (React/Vue/Angular):
- Verify component lifecycle methods
- Check prop types and validation
- Test state updates and re-renders
- Confirm event handlers work
- Verify API integration

#### Backend Files (Node/Python/etc):
- Test all routes/endpoints
- Verify database queries
- Check authentication flow
- Test error handling
- Confirm environment variables

#### Configuration Files:
- Verify syntax is correct
- Test with actual running servers
- Check for typos in keys
- Confirm paths are absolute/relative correctly

---

## 🚨 FORBIDDEN PRACTICES

### ❌ NEVER DO:
1. **Assume previous code works** - always verify
2. **Skip testing** - every change must be tested
3. **Ignore warnings** - they often indicate real issues
4. **Copy-paste without understanding** - know what you're adding
5. **Leave debug code** - clean up before completing
6. **Ignore error messages** - read and address them
7. **Make multiple changes at once** - change incrementally
8. **Forget to restart servers** - changes need fresh start
9. **Skip dependency installation** - always run install commands
10. **Assume configuration is correct** - verify env files

---

## ✅ BEST PRACTICES

### Code Quality:
- Write self-documenting code
- Use meaningful variable names
- Add comments for complex logic
- Follow project's coding standards
- Keep functions small and focused

### Error Handling:
- Handle all error cases
- Provide meaningful error messages
- Log errors appropriately
- Don't swallow exceptions
- Validate inputs

### Testing Strategy:
- Test happy path first
- Then test edge cases
- Test error scenarios
- Verify integration points
- Manual test in browser/client

### Communication:
- Explain what you're changing and why
- Highlight potential issues
- Suggest alternatives when relevant
- Document breaking changes
- Update README if needed

---

## 🎯 TASK COMPLETION STATEMENT

Before considering a task complete, state:

```
VERIFICATION COMPLETE:
✓ Frontend: [specific checks done]
✓ Backend: [specific checks done]
✓ API: [specific checks done]
✓ Database: [specific checks done]
✓ Testing: [what was tested]
✓ No errors in: [console/terminal/logs]
✓ All dependencies: [installed/updated]
✓ Manual verification: [what was tested manually]

STATUS: COMPLETE ✓
```

**If you cannot complete this verification, the task is NOT complete.**

---

## 🔄 WHEN STUCK

If you encounter repeated failures:

1. **STOP** - Don't keep trying the same thing
2. **DOCUMENT** - What have you tried?
3. **ANALYZE** - What's the pattern in failures?
4. **RESEARCH** - Check documentation/Stack Overflow
5. **ASK** - Request human intervention if needed
6. **ALTERNATIVE** - Try a completely different approach

---

## 📝 FINAL REMINDER

**This is not a suggestion - this is MANDATORY protocol.**

Every modification requires:
- Frontend check ✓
- Backend check ✓
- API check ✓
- Database check (if applicable) ✓
- End-to-end testing ✓
- Error-free execution ✓

**No assumptions. No shortcuts. Complete verification.**