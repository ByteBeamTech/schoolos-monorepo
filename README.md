cat << 'EOF' > README.md
# SchoolOS Backend - SaaS Management System

## 🏛 Multi-Tenant & Multi-Branch Architecture
This system is designed for high-scale educational management. It follows a strict hierarchical data isolation model:

1. **Tenant (Account):** The top-level organization (e.g., "primary").
2. **Branch:** A single tenant can have multiple physical or logical branches. 
3. **Data Isolation:** All requests **must** include the `x-tenant-id` header. Operations involving students or leads should also include the `x-branch-id` to ensure correct record association.



---

## 🛠 Tech Stack & Environment (Lucknow Server)
* **Framework:** NestJS (Node.js)
* **Database:** PostgreSQL (Running on **Port 5433**)
* **ORM:** Prisma
* **Process Manager:** PM2 (Service ID: 12)

---

## 🚀 Key Modules & Logic Fixes

### 1. Bulk Student Import
We refactored the `BulkController` and `BulkService` to handle multi-branch parsing. 
* **XOR Logic:** The system ensures a student is created with a valid `branchId`.
* **Service Contract:** `importStudents(tenantId, rows[], branchId)`.

### 2. CRM Leads
Refactored to align with the database schema requirements:
* **Mandatory Fields:** `branchId`, `parentName`, and `parentPhone` are now strictly enforced or defaulted to prevent 500 errors.
* **Prisma XOR Fix:** Resolved the `StudentCreateInput` vs `StudentUncheckedCreateInput` conflict using the `satisfies` operator for type safety.

---

## 💻 Developer Operations

### Database Synchronization
If you modify `schema.prisma`, sync the physical Postgres tables on Port 5433:
```bash
npx prisma db push# Here are your Instructions
