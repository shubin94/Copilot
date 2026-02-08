import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Lock, Unlock, Plus, Edit2, Loader, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks";

type AdminPage = {
  id: string;
  key: string;
  name: string;
  is_active: boolean;
};

type Employee = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  allowedPages: string[];
  createdAt: string;
  updatedAt: string;
};

export default function EmployeesManagement() {
  const [, setLocation] = useLocation();
  const { data: user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pages, setPages] = useState<AdminPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    selectedPages: new Set<string>(),
  });

  // Edit state
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editPages, setEditPages] = useState(new Set<string>());

  // ============ AUTH GUARD ============
  useEffect(() => {
    if (!user) {
      setLocation('/admin/login');
    }
  }, [user, setLocation]);

  // ============ LOAD DATA ============
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);

      // Load pages
      const pagesData = await api.get<{ pages: AdminPage[] }>("/api/admin/employees/pages");
      setPages(pagesData.pages.filter((p: AdminPage) => p.is_active));

      // Load employees
      const empData = await api.get<{ employees: Employee[] }>("/api/admin/employees");
      setEmployees(empData.employees);
    } catch (error) {
      console.error("Failed to load data:", error);
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  // ============ CREATE EMPLOYEE ============
  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      showToast("Email and password required", "error");
      return;
    }

    if (formData.selectedPages.size === 0) {
      showToast("Select at least one page", "error");
      return;
    }

    try {
      const email = formData.email.trim().toLowerCase();
      const newEmployee = await api.post<Employee>("/api/admin/employees", {
        email,
        name: formData.name,
        password: formData.password,
        allowedPages: Array.from(formData.selectedPages),
      });
      setEmployees([newEmployee, ...employees]);
      setFormData({ email: "", password: "", name: "", selectedPages: new Set() });
      setShowForm(false);
      showToast(`Employee ${newEmployee.email} created successfully`, "success");
    } catch (error: any) {
      showToast(error?.message || "Error creating employee", "error");
    }
  }

  // ============ EDIT EMPLOYEE PAGES ============
  async function handleUpdatePages() {
    if (!editingEmployee) return;

    if (editPages.size === 0) {
      showToast("Employee must have at least one page", "error");
      return;
    }

    try {
      await api.patch(`/api/admin/employees/${editingEmployee.id}/pages`, {
        allowedPages: Array.from(editPages),
      });

      // Update employee in list
      setEmployees(
        employees.map((emp) =>
          emp.id === editingEmployee.id
            ? { ...emp, allowedPages: Array.from(editPages) }
            : emp
        )
      );

      setEditingEmployee(null);
      setEditPages(new Set());
      showToast("Pages updated successfully", "success");
    } catch (error: any) {
      showToast(error?.message || "Error updating pages", "error");
    }
  }

  // ============ DEACTIVATE/REACTIVATE EMPLOYEE ============
  async function handleToggleStatus(employee: Employee) {
    try {
      const data = await api.patch<{ isActive: boolean; message: string }>(
        `/api/admin/employees/${employee.id}/deactivate`
      );
      setEmployees(
        employees.map((emp) =>
          emp.id === employee.id ? { ...emp, isActive: data.isActive } : emp
        )
      );

      showToast(data.message, "success");
    } catch (error: any) {
      showToast(error?.message || "Error updating status", "error");
    }
  }

  // ============ DELETE EMPLOYEE ============
  async function handleDeleteEmployee(employee: Employee) {
    if (!window.confirm(`Are you sure you want to delete "${employee.email}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const data = await api.delete<{ message: string }>(
        `/api/admin/employees/${employee.id}`
      );

      // Remove from list immediately
      setEmployees(employees.filter((emp) => emp.id !== employee.id));
      showToast(data.message, "success");
    } catch (error: any) {
      showToast(error?.message || "Error deleting employee", "error");
    }
  }

  // ============ HELPERS ============
  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function togglePageSelection(pageKey: string) {
    const updated = new Set(formData.selectedPages);
    if (updated.has(pageKey)) {
      updated.delete(pageKey);
    } else {
      updated.add(pageKey);
    }
    setFormData({ ...formData, selectedPages: updated });
  }

  function toggleEditPageSelection(pageKey: string) {
    const updated = new Set(editPages);
    if (updated.has(pageKey)) {
      updated.delete(pageKey);
    } else {
      updated.add(pageKey);
    }
    setEditPages(updated);
  }

  // ============ RENDER ============
  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="p-8 flex items-center justify-center">
          <Loader className="animate-spin" size={32} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="p-8 max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 p-4 rounded ${
              toast.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Employee Management</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <Plus size={20} /> New Employee
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white p-6 rounded shadow mb-8">
            <h2 className="text-2xl font-bold mb-6">Create Employee</h2>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    placeholder="Employee name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    placeholder="employee@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    placeholder="Min 8 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Allowed Pages</label>
                <div className="space-y-2 border border-gray-300 p-4 rounded bg-gray-50">
                  {pages.length === 0 ? (
                    <p className="text-gray-500">No active pages available</p>
                  ) : (
                    pages.map((page) => (
                      <label key={page.id} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.selectedPages.has(page.key)}
                          onChange={() => togglePageSelection(page.key)}
                          className="mr-3"
                        />
                        <span>{page.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ email: "", password: "", name: "", selectedPages: new Set() });
                  }}
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Employees Table */}
        <div className="bg-white rounded shadow overflow-hidden">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No employees yet. Create one to get started.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-4 text-left font-medium">Email</th>
                  <th className="p-4 text-left font-medium">Status</th>
                  <th className="p-4 text-left font-medium">Allowed Pages</th>
                  <th className="p-4 text-left font-medium">Created</th>
                  <th className="p-4 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <React.Fragment key={employee.id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-4">{employee.email}</td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded text-sm ${
                            employee.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {employee.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{employee.allowedPages.join(", ")}</td>
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(employee.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 flex gap-2">
                        <button
                          onClick={() => {
                            setEditingEmployee(employee);
                            setEditPages(new Set(employee.allowedPages));
                          }}
                          className="p-2 hover:bg-blue-100 rounded"
                          title="Edit pages"
                        >
                          <Edit2 size={16} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(employee)}
                          className="p-2 hover:bg-yellow-100 rounded"
                          title={employee.isActive ? "Deactivate" : "Reactivate"}
                        >
                          {employee.isActive ? (
                            <Lock size={16} className="text-yellow-600" />
                          ) : (
                            <Unlock size={16} className="text-green-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee)}
                          className="p-2 hover:bg-red-100 rounded"
                          title="Delete employee"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </td>
                    </tr>

                    {/* Edit Pages Modal */}
                    {editingEmployee?.id === employee.id && (
                      <tr className="bg-blue-50 border-b">
                        <td colSpan={5} className="p-4">
                          <div className="bg-white border border-blue-300 rounded p-4">
                            <h3 className="font-bold mb-4">Edit Page Access for {employee.email}</h3>

                            <div className="space-y-2 mb-4 border p-3 rounded bg-gray-50">
                              {pages.map((page) => (
                                <label key={page.id} className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPages.has(page.key)}
                                    onChange={() => toggleEditPageSelection(page.key)}
                                    className="mr-3"
                                  />
                                  <span>{page.name}</span>
                                </label>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={handleUpdatePages}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                              >
                                Update
                              </button>
                              <button
                                onClick={() => {
                                  setEditingEmployee(null);
                                  setEditPages(new Set());
                                }}
                                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
