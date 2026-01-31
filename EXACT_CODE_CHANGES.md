# EXACT CODE CHANGES - LINE-BY-LINE REFERENCE

## File 1: server/storage/cms.ts

### Change 1: createPage Function - Fix Database Client Pool Exhaustion
**Lines:** 316-387
**Type:** Error handling improvement
**Before:** ROLLBACK not wrapped in try/catch
**After:** ROLLBACK wrapped with error logging

```typescript
// LOCATION: Line 379 (in the catch block)
// BEFORE:
} catch (error) {
  await client.query("ROLLBACK");  // Could throw uncaught error
  throw error;
}

// AFTER:
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("[cms] Rollback error:", rollbackError);
  }
  throw error;
}
```

### Change 2: createPage Return Statement - Add Missing Fields
**Lines:** 391-407
**Type:** Response data completion
**Before:** metaTitle and metaDescription fields missing from return object
**After:** Both fields included in return

```typescript
// BEFORE:
return {
  id: pageRow.id,
  title: pageRow.title,
  slug: pageRow.slug,
  categoryId: pageRow.category_id,
  content: pageRow.content,
  status: pageRow.status,
  createdAt: pageRow.created_at,
  updatedAt: pageRow.updated_at,
  tags: tagsResult.rows.map(...),
  // Missing metaTitle and metaDescription!
};

// AFTER:
return {
  id: pageRow.id,
  title: pageRow.title,
  slug: pageRow.slug,
  categoryId: pageRow.category_id,
  content: pageRow.content,
  status: pageRow.status,
  metaTitle: pageRow.meta_title,           // ← ADDED
  metaDescription: pageRow.meta_description, // ← ADDED
  createdAt: pageRow.created_at,
  updatedAt: pageRow.updated_at,
  tags: tagsResult.rows.map(...),
};
```

### Change 3: updatePage Function - Fix Database Client Pool Exhaustion
**Lines:** 443-469
**Type:** Error handling improvement
**Before:** ROLLBACK not wrapped in try/catch
**After:** ROLLBACK wrapped with error logging

```typescript
// LOCATION: Line 459 (in the catch block)
// BEFORE:
} catch (error) {
  await client.query("ROLLBACK");  // Could throw uncaught error
  throw error;
}

// AFTER:
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    console.error("[cms] Rollback error in updatePage:", rollbackError);
  }
  throw error;
}
```

---

## File 2: server/routes/admin-cms.ts

### Change 1: requireAdmin Middleware - Add Authentication Logging
**Lines:** 34-43
**Type:** Diagnostic logging addition
**Before:** No logging context
**After:** Logs userId, role mismatch details

```typescript
// LOCATION: Lines 37-45 in requireAdmin function
// BEFORE:
if (!req.session || !req.session.userId) {
  return res.status(401).json({ error: "Not authenticated" });
}

if (req.session.userRole !== "admin") {
  return res.status(403).json({ error: "Admin access required" });
}

// AFTER:
if (!req.session || !req.session.userId) {
  console.warn("[cms] Unauthorized request - no session");
  return res.status(401).json({ error: "Not authenticated" });
}

if (req.session.userRole !== "admin") {
  console.warn("[cms] Forbidden request - insufficient role", {
    userId: req.session.userId,
    actualRole: req.session.userRole,
    requiredRole: "admin"
  });
  return res.status(403).json({ error: "Admin access required" });
}
```

### Change 2: POST /api/admin/categories - Add Null Check & Error Logging
**Lines:** 60-84
**Type:** Validation and error handling
**Before:** No null check, generic error logging
**After:** Checks createCategory result, separates error types, full logging

```typescript
// LOCATION: In the try block, after createCategory call
// BEFORE:
const category = await createCategory(name, slug, status);
res.json({ category });  // What if category is null?

// AND in the catch block:
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Create category error:", error);
  res.status(500).json({ error: "Failed to create category" });
}

// AFTER:
const category = await createCategory(name, slug, status);
if (!category) {
  console.error("[cms] Create category error - null result after INSERT", { name, slug, status });
  return res.status(500).json({ error: "Failed to create category" });
}
res.json({ category });

// AND in the catch block:
} catch (error) {
  if (error instanceof z.ZodError) {
    console.warn("[cms] Validation error creating category:", fromZodError(error).message);
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Create category error - system error:", {
    name: req.body.name,
    slug: req.body.slug,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  res.status(500).json({ error: "Failed to create category" });
}
```

### Change 3: PATCH /api/admin/categories/:id - Add Error Logging Context
**Lines:** 88-115
**Type:** Error handling enhancement
**Before:** Generic error logging
**After:** Validation/system error separation, full context logging

```typescript
// LOCATION: In the catch block
// BEFORE:
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Update category error:", error);
  res.status(500).json({ error: "Failed to update category" });
}

// AFTER:
} catch (error) {
  if (error instanceof z.ZodError) {
    console.warn("[cms] Validation error updating category:", fromZodError(error).message);
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Update category error - system error:", {
    categoryId: req.params.id,
    name: req.body.name,
    status: req.body.status,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  res.status(500).json({ error: "Failed to update category" });
}
```

### Change 4: DELETE /api/admin/categories/:id - Add Error Logging Context
**Lines:** 117-134
**Type:** Error handling enhancement
**Before:** Generic error logging
**After:** Detailed error context

```typescript
// LOCATION: In the catch block
// BEFORE:
} catch (error) {
  console.error("[cms] Delete category error:", error);
  res.status(500).json({ error: "Failed to delete category" });
}

// AFTER:
} catch (error) {
  console.error("[cms] Delete category error - system error:", {
    categoryId: req.params.id,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  res.status(500).json({ error: "Failed to delete category" });
}
```

### Change 5: POST /api/admin/tags - Add Null Check & Error Logging
**Lines:** 145-169
**Type:** Validation and error handling
**Before:** No null check, generic error logging
**After:** Checks createTag result, separates error types, full logging

```typescript
// Similar pattern to Change 2 (POST /categories)
// BEFORE:
const tag = await createTag(name, slug, status);
res.json({ tag });

// AFTER:
const tag = await createTag(name, slug, status);
if (!tag) {
  console.error("[cms] Create tag error - null result after INSERT", { name, slug, status });
  return res.status(500).json({ error: "Failed to create tag" });
}
res.json({ tag });

// With catch block improvements for validation vs system errors
```

### Change 6: PATCH /api/admin/tags/:id - Add Error Logging Context
**Lines:** 173-200
**Type:** Error handling enhancement
**Before:** Generic error logging
**After:** Validation/system error separation, full context logging

```typescript
// Similar pattern to Change 3 (PATCH /categories)
// Adds validation warning and system error with tagId context
```

### Change 7: DELETE /api/admin/tags/:id - Add Error Logging Context
**Lines:** 202-219
**Type:** Error handling enhancement
**Before:** Generic error logging
**After:** Detailed error context with tagId

```typescript
// Similar pattern to Change 4 (DELETE /categories)
```

### Change 8: POST /api/admin/pages - Add Null Check & Enhanced Error Logging
**Lines:** 228-280
**Type:** Validation and error handling
**Before:** No null check, generic error logging
**After:** Checks createPage result, separates error types, full logging

```typescript
// LOCATION: In the try block, after createPage call
// BEFORE:
const page = await createPage(...);
res.json({ page });

// AFTER:
const page = await createPage(...);
if (!page) {
  console.error("[cms] Create page error - null result after INSERT", {
    title,
    slug,
    categoryId,
    content: content?.substring(0, 100)
  });
  return res.status(500).json({ error: "Failed to create page" });
}
res.json({ page });

// AND in the catch block:
// BEFORE:
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Create page error:", error);
  res.status(500).json({ error: "Failed to create page" });
}

// AFTER:
} catch (error) {
  if (error instanceof z.ZodError) {
    console.warn("[cms] Create page validation error:", fromZodError(error).message);
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Create page error - system error:", {
    title: req.body.title,
    slug: req.body.slug,
    categoryId: req.body.categoryId,
    contentLength: req.body.content?.length,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  res.status(500).json({ error: "Failed to create page" });
}
```

### Change 9: PATCH /api/admin/pages/:id - Add Enhanced Error Logging
**Lines:** 282-340
**Type:** Error handling enhancement
**Before:** Generic error logging with no context
**After:** Validation/system error separation, full context with page details

```typescript
// LOCATION: In the catch block
// BEFORE:
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Update page error:", error);
  res.status(500).json({ error: "Failed to update page" });
}

// AFTER:
} catch (error) {
  if (error instanceof z.ZodError) {
    console.warn("[cms] Validation error updating page:", fromZodError(error).message);
    return res.status(400).json({ error: fromZodError(error).message });
  }
  console.error("[cms] Update page error - system error:", {
    pageId: req.params.id,
    title: req.body.title,
    slug: req.body.slug,
    categoryId: req.body.categoryId,
    status: req.body.status,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  res.status(500).json({ error: "Failed to update page" });
}
```

### Change 10: DELETE /api/admin/pages/:id - Add Error Logging Context
**Lines:** 352-368
**Type:** Error handling enhancement
**Before:** Generic error logging
**After:** Detailed error context with pageId

```typescript
// LOCATION: In the catch block
// BEFORE:
} catch (error) {
  console.error("[cms] Delete page error:", error);
  res.status(500).json({ error: "Failed to delete page" });
}

// AFTER:
} catch (error) {
  console.error("[cms] Delete page error - system error:", {
    pageId: req.params.id,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  res.status(500).json({ error: "Failed to delete page" });
}
```

---

## SUMMARY TABLE

| Change # | File | Lines | Type | Impact |
|----------|------|-------|------|--------|
| 1 | cms.ts | 379 | Pool fix | HIGH |
| 2 | cms.ts | 391-407 | Data fix | MEDIUM |
| 3 | cms.ts | 459 | Pool fix | HIGH |
| 4 | admin-cms.ts | 37-45 | Logging | HIGH |
| 5 | admin-cms.ts | 60-84 | Validation | HIGH |
| 6 | admin-cms.ts | 88-115 | Logging | HIGH |
| 7 | admin-cms.ts | 117-134 | Logging | MEDIUM |
| 8 | admin-cms.ts | 145-169 | Validation | HIGH |
| 9 | admin-cms.ts | 173-200 | Logging | HIGH |
| 10 | admin-cms.ts | 202-219 | Logging | MEDIUM |
| 11 | admin-cms.ts | 228-280 | Validation | HIGH |
| 12 | admin-cms.ts | 282-340 | Logging | HIGH |
| 13 | admin-cms.ts | 352-368 | Logging | MEDIUM |

**Total Impact:** 13 targeted improvements fixing 5 root causes
