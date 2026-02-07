import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../../../db/index.ts";
import { requireRole } from "../../authMiddleware.ts";

const router = Router();

// ============ HELPERS ============

/**
 * Check if user is trying to modify themselves
 */
function isSelfModification(currentUserId: string, targetUserId: string): boolean {
  return currentUserId === targetUserId;
}

// ============ GET /api/admin/employees/pages ============
/**
 * List available access-control pages
 */
router.get(
  "/pages",
  requireRole("admin", "employee"),
  async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        "SELECT id, key, name, is_active FROM access_pages WHERE is_active = true ORDER BY name ASC"
      );

      return res.status(200).json({
        pages: result.rows.map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          is_active: row.is_active,
        })),
      });
    } catch (error: any) {
      console.error("[GetAccessPages] Error:", error.message);
      return res.status(500).json({ error: "Failed to fetch pages" });
    }
  }
);

// ============ POST /api/admin/employees ============
/**
 * Create a new employee with allowed pages
 */
router.post(
  "/",
  requireRole("admin", "employee"),
  async (req: Request, res: Response) => {
    try {
      const { email, password, name, allowedPages } = req.body as {
        email?: string;
        password?: string;
        name?: string;
        allowedPages?: string[];
      };

      const normalizedEmail = (email || "").toLowerCase().trim();
      const normalizedName = (name || "").trim();

      if (!normalizedEmail || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      if (!Array.isArray(allowedPages) || allowedPages.length === 0) {
        return res.status(400).json({ error: "Employee must have at least one page" });
      }

      const existing = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [normalizedEmail]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }

      // Validate page keys
      const pageQuery = await pool.query(
        "SELECT id, key FROM access_pages WHERE key = ANY($1) AND is_active = true",
        [allowedPages]
      );

      const validPages = pageQuery.rows;
      const foundKeys = validPages.map((page) => page.key);
      const missingKeys = allowedPages.filter((key) => !foundKeys.includes(key));

      if (missingKeys.length > 0) {
        return res.status(400).json({
          error: "Invalid page keys",
          invalid: missingKeys,
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const fallbackName = normalizedEmail.split("@")[0] || "Employee";
      const finalName = normalizedName || fallbackName;

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const userResult = await client.query(
          `INSERT INTO users (email, password, name, role)
           VALUES ($1, $2, $3, 'employee')
           RETURNING id, email, name, role, created_at, updated_at`,
          [normalizedEmail, hashedPassword, finalName]
        );

        const user = userResult.rows[0];

        const mappingValues = validPages
          .map((page, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
          .join(",");
        const mappingParams = validPages.flatMap((page) => [user.id, page.id]);

        if (validPages.length > 0) {
          await client.query(
            `INSERT INTO user_pages (user_id, page_id)
             VALUES ${mappingValues}`,
            mappingParams
          );
        }

        await client.query("COMMIT");

        return res.status(201).json({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: true,
          allowedPages: foundKeys,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        });
      } catch (txError) {
        await client.query("ROLLBACK");
        throw txError;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error("[CreateEmployee] Error:", error.message);
       console.error("[CreateEmployee] Full error:", error);
       if (error.detail) console.error("[CreateEmployee] SQL detail:", error.detail);
      return res.status(500).json({ error: "Failed to create employee" });
    }
  }
);

// ============ GET /api/admin/employees ============
/**
 * List all employees (active and inactive)
 */
router.get(
  "/",
  requireRole("admin", "employee"),
  async (req: Request, res: Response) => {
    try {
      const employees = await pool.query(`
        SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL) as allowed_pages
        FROM users u
        LEFT JOIN user_pages up ON u.id = up.user_id
        LEFT JOIN access_pages p ON up.page_id = p.id AND p.is_active = true
        WHERE u.role = 'employee'
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

      return res.status(200).json({
        employees: employees.rows.map(row => ({
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          isActive: row.is_active,
          allowedPages: row.allowed_pages || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });

    } catch (error: any) {
      console.error("[GetEmployees] Error:", error.message);
      return res.status(500).json({ error: "Failed to fetch employees" });
    }
  }
);

// ============ GET /api/admin/employees/:id ============
/**
 * Get single employee with full details
 */
router.get(
  "/:id",
  requireRole("admin", "employee"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.is_active,
          u.created_at,
          u.updated_at,
          ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL) as allowed_pages,
          ARRAY_AGG(p.id) FILTER (WHERE p.id IS NOT NULL) as page_ids
        FROM users u
        LEFT JOIN user_pages up ON u.id = up.user_id
        LEFT JOIN access_pages p ON up.page_id = p.id AND p.is_active = true
        WHERE u.id = $1 AND u.role = 'employee'
        GROUP BY u.id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const row = result.rows[0];
      return res.status(200).json({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        isActive: row.is_active,
        allowedPages: row.allowed_pages || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });

    } catch (error: any) {
      console.error("[GetEmployee] Error:", error.message);
      return res.status(500).json({ error: "Failed to fetch employee" });
    }
  }
);

// ============ PATCH /api/admin/employees/:id/pages ============
/**
 * Update employee's allowed pages
 */
router.patch(
  "/:id/pages",
  requireRole("admin", "employee"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { allowedPages } = req.body as { allowedPages?: string[] };
      const currentUserId = req.session.userId;

      // Check self-modification
      if (isSelfModification(currentUserId, id)) {
        return res.status(403).json({ error: "Cannot modify your own access" });
      }

      // Validate input
      if (!Array.isArray(allowedPages)) {
        return res.status(400).json({ error: "allowedPages must be an array" });
      }

      if (allowedPages.length === 0) {
        return res.status(400).json({ error: "Employee must have at least one page" });
      }

      // Verify employee exists
      const employeeCheck = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'employee'",
        [id]
      );

      if (employeeCheck.rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Validate page keys
      const pageQuery = await pool.query(
        "SELECT id, key FROM access_pages WHERE key = ANY($1) AND is_active = true",
        [allowedPages]
      );

      const validPages = pageQuery.rows;
      const foundKeys = validPages.map(p => p.key);
      const missingKeys = allowedPages.filter(k => !foundKeys.includes(k));

      if (missingKeys.length > 0) {
        return res.status(400).json({
          error: "Invalid page keys",
          invalid: missingKeys,
        });
      }

      // Update pages in transaction
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Delete old mappings
        await client.query(
          "DELETE FROM user_pages WHERE user_id = $1",
          [id]
        );

        // Insert new mappings
        const mappingValues = validPages
          .map((page, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`)
          .join(",");

        const mappingParams = validPages.flatMap(page => [id, page.id]);

        if (validPages.length > 0) {
          await client.query(
            `INSERT INTO user_pages (user_id, page_id)
             VALUES ${mappingValues}`,
            mappingParams
          );
        }

        await client.query("COMMIT");

        return res.status(200).json({
          id,
          allowedPages: foundKeys,
          message: "Pages updated successfully",
        });

      } catch (txError) {
        await client.query("ROLLBACK");
        throw txError;
      } finally {
        client.release();
      }

    } catch (error: any) {
      console.error("[UpdateEmployeePages] Error:", error.message);
      return res.status(500).json({ error: "Failed to update employee pages" });
    }
  }
);

// ============ PATCH /api/admin/employees/:id/deactivate ============
/**
 * Soft delete (deactivate) an employee
 */
router.patch(
  "/:id/deactivate",
  requireRole("admin", "employee"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const currentUserId = req.session.userId;

      // Check self-modification
      if (isSelfModification(currentUserId, id)) {
        return res.status(403).json({ error: "Cannot deactivate your own account" });
      }

      // Verify employee exists
      const employeeCheck = await pool.query(
        "SELECT id, is_active FROM users WHERE id = $1 AND role = 'employee'",
        [id]
      );

      if (employeeCheck.rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const isActive = employeeCheck.rows[0].is_active;

      // Update is_active
      await pool.query(
        "UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2",
        [!isActive, id]
      );

      return res.status(200).json({
        id,
        isActive: !isActive,
        message: isActive ? "Employee deactivated" : "Employee reactivated",
      });

    } catch (error: any) {
      console.error("[DeactivateEmployee] Error:", error.message);
      return res.status(500).json({ error: "Failed to update employee status" });
    }
  }
);

// ============ DELETE /api/admin/employees/:id ============
/**
 * Hard delete an employee - removes all access and disables login
 */
router.delete(
  "/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const currentUserId = req.session.userId;

      // Check self-modification
      if (isSelfModification(currentUserId, id)) {
        return res.status(403).json({ error: "Cannot delete your own account" });
      }

      // Verify employee exists
      const employeeCheck = await pool.query(
        "SELECT id, email FROM users WHERE id = $1 AND role = 'employee'",
        [id]
      );

      if (employeeCheck.rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const employee = employeeCheck.rows[0];

      // Use transaction to atomically delete access and disable login
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Delete all user_pages entries to remove access
        await client.query(
          "DELETE FROM user_pages WHERE user_id = $1",
          [id]
        );

        // Disable login by setting is_active = false
        await client.query(
          "UPDATE users SET is_active = false, updated_at = now() WHERE id = $1",
          [id]
        );

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return res.status(200).json({
        id,
        message: `Employee "${employee.email}" has been deleted and all access removed`,
      });

    } catch (error: any) {
      console.error("[DeleteEmployee] Error:", error.message);
      return res.status(500).json({ error: "Failed to delete employee" });
    }
  }
);

export default router;
