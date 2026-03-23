"""
SchoolOS Superadmin/SaaS Owner Backend
Multi-tenant school management platform - SaaS control center
"""
import os
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from contextlib import asynccontextmanager

import jwt
from fastapi import FastAPI, HTTPException, Depends, Header, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

# Environment
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "schoolos")
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_EXPIRY_HOURS = 24

# MongoDB client
client: AsyncIOMotorClient = None
db = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("tenantId")
    await db.tenants.create_index("slug", unique=True)
    await db.pricing_plans.create_index([("tier", 1), ("currency", 1)])
    await db.subscriptions.create_index("tenantId", unique=True)
    await db.fraud_alerts.create_index([("status", 1), ("createdAt", -1)])
    await db.audit_logs.create_index([("tenantId", 1), ("createdAt", -1)])
    
    # Seed default superadmin if not exists
    await seed_default_data()
    
    yield
    client.close()


app = FastAPI(
    title="SchoolOS Superadmin API",
    description="SaaS Owner Control Center for SchoolOS",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    accessToken: str
    user: dict
    redirectPath: str = "/dashboard"


class OnboardTenantRequest(BaseModel):
    schoolName: str
    slug: str
    adminEmail: EmailStr
    adminFirstName: str
    adminLastName: str
    adminPassword: str
    contactPhone: str
    planId: Optional[str] = None
    region: str = "IN"
    currency: str = "INR"
    maxStudents: int = 500
    trialDays: int = 30
    sessionName: Optional[str] = None


class CreatePlanRequest(BaseModel):
    name: str
    tier: str = "STARTER"
    model: str = "SUBSCRIPTION"
    currency: str = "INR"
    region: str = "IN"
    baseFee: Optional[float] = None
    perStudentRate: Optional[float] = None
    studentLimit: Optional[int] = None
    overageRate: Optional[float] = None
    overageEnabled: bool = False
    trialDays: int = 30


class UpdateStatusRequest(BaseModel):
    status: str


class ResetPasswordRequest(BaseModel):
    password: str


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def create_token(user_id: str, email: str, role: str, tenant_id: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "tenantId": tenant_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    return payload


async def require_superadmin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="SUPER_ADMIN role required")
    return user


def serialize_doc(doc: dict) -> dict:
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def serialize_docs(docs: list) -> list:
    return [serialize_doc(d) for d in docs]


async def seed_default_data():
    """Seed default superadmin and pricing plans"""
    # Superadmin user
    existing = await db.users.find_one({"email": "superadmin@schoolos.com"})
    if not existing:
        await db.users.insert_one({
            "_id": str(uuid.uuid4()),
            "email": "superadmin@schoolos.com",
            "passwordHash": hash_password("admin123"),
            "firstName": "Super",
            "lastName": "Admin",
            "role": "SUPER_ADMIN",
            "tenantId": "schoolos-platform",
            "isActive": True,
            "createdAt": datetime.now(timezone.utc)
        })
        print("✓ Created default superadmin: superadmin@schoolos.com / admin123")

    # Default pricing plans
    plans_count = await db.pricing_plans.count_documents({})
    if plans_count == 0:
        default_plans = [
            {"name": "Starter India", "tier": "STARTER", "model": "PER_STUDENT", "currency": "INR", "region": "IN", "perStudentRate": 50, "studentLimit": 500, "trialDays": 30, "isActive": True},
            {"name": "Growth India", "tier": "GROWTH", "model": "SUBSCRIPTION", "currency": "INR", "region": "IN", "baseFee": 15000, "studentLimit": 1000, "trialDays": 14, "isActive": True},
            {"name": "Pro India", "tier": "PRO", "model": "HYBRID", "currency": "INR", "region": "IN", "baseFee": 25000, "perStudentRate": 30, "studentLimit": 2000, "overageEnabled": True, "overageRate": 25, "trialDays": 14, "isActive": True},
            {"name": "Enterprise India", "tier": "ENTERPRISE", "model": "SUBSCRIPTION", "currency": "INR", "region": "IN", "baseFee": 100000, "studentLimit": 10000, "trialDays": 30, "isActive": True},
            {"name": "Starter US", "tier": "STARTER", "model": "PER_STUDENT", "currency": "USD", "region": "US", "perStudentRate": 2, "studentLimit": 500, "trialDays": 30, "isActive": True},
            {"name": "Pro US", "tier": "PRO", "model": "SUBSCRIPTION", "currency": "USD", "region": "US", "baseFee": 299, "studentLimit": 2000, "trialDays": 14, "isActive": True},
        ]
        for plan in default_plans:
            plan["_id"] = str(uuid.uuid4())
            plan["createdAt"] = datetime.now(timezone.utc)
        await db.pricing_plans.insert_many(default_plans)
        print(f"✓ Seeded {len(default_plans)} pricing plans")


# ═══════════════════════════════════════════════════════════════════════════════
# Auth Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest, x_tenant_id: str = Header("schoolos-platform")):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("isActive", True):
        raise HTTPException(status_code=401, detail="Account deactivated")
    
    token = create_token(user["_id"], user["email"], user["role"], user["tenantId"])
    
    # Update last login
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastLoginAt": datetime.now(timezone.utc)}}
    )
    
    return {
        "accessToken": token,
        "user": {
            "id": user["_id"],
            "email": user["email"],
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "role": user["role"],
            "tenantId": user["tenantId"]
        },
        "redirectPath": "/dashboard"
    }


@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# Tenants / Onboarding
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/onboarding/plans")
async def get_plans(_: dict = Depends(require_superadmin)):
    plans = await db.pricing_plans.find({"isActive": True}).sort([("tier", 1), ("currency", 1)]).to_list(100)
    return serialize_docs(plans)


@app.get("/api/onboarding/check-slug/{slug}")
async def check_slug(slug: str, _: dict = Depends(require_superadmin)):
    exists = await db.tenants.find_one({"slug": slug})
    return {"available": not exists, "slug": slug}


@app.get("/api/onboarding/tenants")
async def list_tenants(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    _: dict = Depends(require_superadmin)
):
    query = {"deletedAt": None}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"slug": {"$regex": search, "$options": "i"}},
            {"contactEmail": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.tenants.count_documents(query)
    skip = (page - 1) * limit
    
    pipeline = [
        {"$match": query},
        {"$sort": {"createdAt": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$lookup": {
            "from": "subscriptions",
            "localField": "_id",
            "foreignField": "tenantId",
            "as": "subscription"
        }},
        {"$unwind": {"path": "$subscription", "preserveNullAndEmptyArrays": True}},
        {"$lookup": {
            "from": "pricing_plans",
            "localField": "subscription.planId",
            "foreignField": "_id",
            "as": "subscription.plan"
        }},
        {"$unwind": {"path": "$subscription.plan", "preserveNullAndEmptyArrays": True}},
        {"$lookup": {
            "from": "students",
            "localField": "_id",
            "foreignField": "tenantId",
            "as": "students"
        }},
        {"$addFields": {
            "_count": {"students": {"$size": "$students"}}
        }},
        {"$project": {"students": 0}}
    ]
    
    tenants = await db.tenants.aggregate(pipeline).to_list(limit)
    
    return {
        "data": serialize_docs(tenants),
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "lastPage": max(1, (total + limit - 1) // limit)
        }
    }


@app.get("/api/onboarding/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, _: dict = Depends(require_superadmin)):
    pipeline = [
        {"$match": {"_id": tenant_id}},
        {"$lookup": {
            "from": "subscriptions",
            "localField": "_id",
            "foreignField": "tenantId",
            "as": "subscription"
        }},
        {"$unwind": {"path": "$subscription", "preserveNullAndEmptyArrays": True}},
        {"$lookup": {
            "from": "pricing_plans",
            "localField": "subscription.planId",
            "foreignField": "_id",
            "as": "subscription.plan"
        }},
        {"$unwind": {"path": "$subscription.plan", "preserveNullAndEmptyArrays": True}},
        {"$lookup": {
            "from": "users",
            "let": {"tenantId": "$_id"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$tenantId", "$$tenantId"]},
                    {"$eq": ["$role", "SCHOOL_ADMIN"]},
                    {"$eq": ["$isActive", True]}
                ]}}}
            ],
            "as": "users"
        }},
        {"$lookup": {
            "from": "students",
            "localField": "_id",
            "foreignField": "tenantId",
            "as": "students"
        }},
        {"$addFields": {
            "_count": {"students": {"$size": "$students"}, "users": {"$size": "$users"}}
        }},
        {"$project": {"students": 0}}
    ]
    
    results = await db.tenants.aggregate(pipeline).to_list(1)
    if not results:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return serialize_doc(results[0])


@app.post("/api/onboarding/tenant")
async def onboard_tenant(req: OnboardTenantRequest, user: dict = Depends(require_superadmin)):
    # Check slug availability
    existing_slug = await db.tenants.find_one({"slug": req.slug})
    if existing_slug:
        raise HTTPException(status_code=409, detail=f"School ID '{req.slug}' is already taken")
    
    # Check email availability
    existing_email = await db.users.find_one({"email": req.adminEmail.lower()})
    if existing_email:
        raise HTTPException(status_code=409, detail=f"Email '{req.adminEmail}' is already registered")
    
    # Get plan
    plan = None
    if req.planId:
        plan = await db.pricing_plans.find_one({"_id": req.planId})
    if not plan:
        plan = await db.pricing_plans.find_one({"tier": "STARTER", "currency": req.currency, "isActive": True})
    if not plan:
        plan = await db.pricing_plans.find_one({"isActive": True})
    if not plan:
        raise HTTPException(status_code=400, detail="No active pricing plans found")
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=req.trialDays)
    tenant_id = str(uuid.uuid4())
    admin_id = str(uuid.uuid4())
    sub_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    year = now.year
    session_name = req.sessionName or f"{year}-{str(year + 1)[2:]}"
    
    # Create tenant
    tenant = {
        "_id": tenant_id,
        "name": req.schoolName,
        "slug": req.slug,
        "contactEmail": req.adminEmail.lower(),
        "contactPhone": req.contactPhone,
        "status": "TRIAL" if req.trialDays > 0 else "ACTIVE",
        "featureTier": plan["tier"],
        "maxStudents": req.maxStudents,
        "region": req.region,
        "currency": req.currency,
        "timezone": "America/New_York" if req.region == "US" else "Asia/Kolkata",
        "locale": "en-US" if req.region == "US" else "en-IN",
        "createdAt": now,
        "deletedAt": None
    }
    
    # Create admin user
    admin_user = {
        "_id": admin_id,
        "tenantId": tenant_id,
        "email": req.adminEmail.lower(),
        "passwordHash": hash_password(req.adminPassword),
        "firstName": req.adminFirstName,
        "lastName": req.adminLastName,
        "role": "SCHOOL_ADMIN",
        "isActive": True,
        "isEmailVerified": False,
        "createdAt": now
    }
    
    # Create subscription
    subscription = {
        "_id": sub_id,
        "tenantId": tenant_id,
        "planId": plan["_id"],
        "model": plan["model"],
        "status": "TRIAL" if req.trialDays > 0 else "ACTIVE",
        "currency": req.currency,
        "currentPeriodStart": now,
        "currentPeriodEnd": trial_end,
        "trialEndsAt": trial_end if req.trialDays > 0 else None,
        "createdAt": now
    }
    
    # Create academic session
    session = {
        "_id": session_id,
        "tenantId": tenant_id,
        "name": session_name,
        "startDate": datetime(year, 4, 1),
        "endDate": datetime(year + 1, 3, 31),
        "isCurrent": True,
        "isLocked": False,
        "createdAt": now
    }
    
    # Audit log
    audit = {
        "_id": str(uuid.uuid4()),
        "tenantId": tenant_id,
        "actorId": user["sub"],
        "actorRole": "SUPER_ADMIN",
        "action": "CREATE",
        "entityType": "Tenant",
        "entityId": tenant_id,
        "after": {"name": tenant["name"], "slug": tenant["slug"], "plan": plan["name"], "trialDays": req.trialDays},
        "createdAt": now
    }
    
    # Insert all
    await db.tenants.insert_one(tenant)
    await db.users.insert_one(admin_user)
    await db.subscriptions.insert_one(subscription)
    await db.academic_sessions.insert_one(session)
    await db.audit_logs.insert_one(audit)
    
    return {
        "success": True,
        "tenantId": tenant_id,
        "slug": req.slug,
        "name": req.schoolName,
        "adminEmail": req.adminEmail.lower(),
        "plan": plan["name"],
        "trialEndsAt": trial_end.isoformat() if req.trialDays > 0 else None,
        "sessionName": session_name,
        "loginUrl": "http://localhost:4000/login",
        "message": f"School '{req.schoolName}' onboarded successfully"
    }


@app.patch("/api/onboarding/tenants/{tenant_id}/status")
async def update_tenant_status(tenant_id: str, req: UpdateStatusRequest, user: dict = Depends(require_superadmin)):
    result = await db.tenants.update_one(
        {"_id": tenant_id},
        {"$set": {"status": req.status, "updatedAt": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Audit log
    await db.audit_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "tenantId": tenant_id,
        "actorId": user["sub"],
        "actorRole": "SUPER_ADMIN",
        "action": "UPDATE",
        "entityType": "Tenant",
        "entityId": tenant_id,
        "after": {"status": req.status},
        "createdAt": datetime.now(timezone.utc)
    })
    
    tenant = await db.tenants.find_one({"_id": tenant_id})
    return serialize_doc(tenant)


@app.post("/api/onboarding/tenants/{tenant_id}/reset-password")
async def reset_admin_password(tenant_id: str, req: ResetPasswordRequest, user: dict = Depends(require_superadmin)):
    admin = await db.users.find_one({"tenantId": tenant_id, "role": "SCHOOL_ADMIN", "isActive": True})
    if not admin:
        raise HTTPException(status_code=400, detail="No active SCHOOL_ADMIN found")
    
    await db.users.update_one(
        {"_id": admin["_id"]},
        {"$set": {"passwordHash": hash_password(req.password)}}
    )
    
    await db.audit_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "tenantId": tenant_id,
        "actorId": user["sub"],
        "actorRole": "SUPER_ADMIN",
        "action": "UPDATE",
        "entityType": "User",
        "entityId": admin["_id"],
        "after": {"action": "password_reset_by_superadmin"},
        "createdAt": datetime.now(timezone.utc)
    })
    
    return {"success": True, "adminEmail": admin["email"]}


# ═══════════════════════════════════════════════════════════════════════════════
# SaaS Billing / Pricing
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/saas/pricing-plans")
async def get_pricing_plans(_: dict = Depends(require_superadmin)):
    plans = await db.pricing_plans.find({}).sort("createdAt", -1).to_list(100)
    return serialize_docs(plans)


@app.post("/api/saas/pricing-plans")
async def create_pricing_plan(req: CreatePlanRequest, _: dict = Depends(require_superadmin)):
    plan = {
        "_id": str(uuid.uuid4()),
        "name": req.name,
        "tier": req.tier,
        "model": req.model,
        "currency": req.currency,
        "region": req.region,
        "baseFee": req.baseFee,
        "perStudentRate": req.perStudentRate,
        "studentLimit": req.studentLimit,
        "overageRate": req.overageRate,
        "overageEnabled": req.overageEnabled,
        "trialDays": req.trialDays,
        "isActive": True,
        "createdAt": datetime.now(timezone.utc)
    }
    await db.pricing_plans.insert_one(plan)
    return serialize_doc(plan)


@app.get("/api/saas/invoices")
async def get_invoices(limit: int = Query(50), _: dict = Depends(require_superadmin)):
    # Return empty for now - invoices are generated by billing cycle processor
    invoices = await db.saas_invoices.find({}).sort("createdAt", -1).limit(limit).to_list(limit)
    return {"data": serialize_docs(invoices)}


# ═══════════════════════════════════════════════════════════════════════════════
# Fraud Alerts
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/fraud/alerts")
async def get_fraud_alerts(
    status: str = Query("OPEN"),
    limit: int = Query(100),
    _: dict = Depends(require_superadmin)
):
    query = {"status": status} if status else {}
    alerts = await db.fraud_alerts.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    
    # Enrich with tenant info
    for alert in alerts:
        if alert.get("tenantId"):
            tenant = await db.tenants.find_one({"_id": alert["tenantId"]}, {"name": 1, "slug": 1})
            alert["tenant"] = serialize_doc(tenant) if tenant else None
    
    return serialize_docs(alerts)


@app.patch("/api/fraud/alerts/{alert_id}")
async def update_fraud_alert(alert_id: str, status: str = Body(..., embed=True), _: dict = Depends(require_superadmin)):
    result = await db.fraud_alerts.update_one(
        {"_id": alert_id},
        {"$set": {"status": status, "resolvedAt": datetime.now(timezone.utc) if status == "RESOLVED" else None}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════════════
# Superadmin Analytics
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/superadmin/revenue")
async def get_revenue_intelligence(_: dict = Depends(require_superadmin)):
    # Get all active subscriptions
    subscriptions = await db.subscriptions.find({"status": {"$in": ["ACTIVE", "TRIAL", "PAST_DUE"]}}).to_list(1000)
    
    mrr = 0
    for sub in subscriptions:
        plan = await db.pricing_plans.find_one({"_id": sub.get("planId")})
        if plan:
            if plan.get("model") == "SUBSCRIPTION":
                mrr += float(plan.get("baseFee") or 0)
            elif plan.get("model") == "PER_STUDENT":
                rate = float(plan.get("perStudentRate") or 0)
                count = sub.get("studentCountAtBilling") or 0
                mrr += rate * count
            elif plan.get("model") == "HYBRID":
                mrr += float(plan.get("baseFee") or 0)
                rate = float(plan.get("perStudentRate") or 0)
                count = sub.get("studentCountAtBilling") or 0
                mrr += rate * count
    
    # Invoice aging
    invoices = await db.saas_invoices.find({"status": {"$in": ["SENT", "OVERDUE", "PARTIALLY_PAID"]}}).to_list(1000)
    now = datetime.now(timezone.utc)
    aging = {"current": 0, "days30": 0, "days60": 0, "days90plus": 0}
    aging_details = []
    
    for inv in invoices:
        due_date = inv.get("dueDate", now)
        if isinstance(due_date, str):
            due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
        days_due = (now - due_date).days
        amount = float(inv.get("totalAmount") or 0)
        
        tenant = await db.tenants.find_one({"_id": inv.get("tenantId")}, {"name": 1})
        
        detail = {
            "invoiceNumber": inv.get("invoiceNumber", "—"),
            "tenantName": tenant.get("name", "—") if tenant else "—",
            "amount": amount,
            "daysOverdue": max(0, days_due),
            "dueDate": due_date.isoformat() if isinstance(due_date, datetime) else due_date,
            "status": inv.get("status")
        }
        aging_details.append(detail)
        
        if days_due <= 0:
            aging["current"] += amount
        elif days_due <= 30:
            aging["days30"] += amount
        elif days_due <= 60:
            aging["days60"] += amount
        else:
            aging["days90plus"] += amount
    
    # Revenue by region
    revenue_by_region = {}
    tenants = await db.tenants.find({"status": "ACTIVE"}, {"region": 1}).to_list(1000)
    for t in tenants:
        region = t.get("region", "GLOBAL")
        revenue_by_region[region] = revenue_by_region.get(region, 0) + (mrr / max(len(tenants), 1))
    
    return {
        "mrr": round(mrr),
        "arr": round(mrr * 12),
        "activeSubscriptions": len(subscriptions),
        "aging": {
            "buckets": aging,
            "details": sorted(aging_details, key=lambda x: -x["daysOverdue"])[:20]
        },
        "churn": {"totalCancelled": 0, "recent": [], "byReason": {}},
        "revenueByRegion": revenue_by_region
    }


@app.get("/api/superadmin/health")
async def get_tenant_health(_: dict = Depends(require_superadmin)):
    tenants = await db.tenants.find({"status": {"$in": ["ACTIVE", "TRIAL"]}}).to_list(1000)
    
    scores = []
    for t in tenants:
        score = 0
        
        # Login activity
        recent_logins = await db.audit_logs.count_documents({
            "tenantId": t["_id"],
            "action": "LOGIN",
            "createdAt": {"$gte": datetime.now(timezone.utc) - timedelta(days=7)}
        })
        score += min(recent_logins * 5, 30)
        
        # Student count
        student_count = await db.students.count_documents({"tenantId": t["_id"]})
        score += min(student_count // 10, 20)
        
        # Features used
        entity_types = await db.audit_logs.distinct("entityType", {"tenantId": t["_id"]})
        score += min(len(entity_types) * 3, 25)
        
        # Subscription status
        sub = await db.subscriptions.find_one({"tenantId": t["_id"]})
        if sub:
            if sub.get("status") == "ACTIVE":
                score += 25
            elif sub.get("status") == "TRIAL":
                score += 15
        
        final_score = min(round(score), 100)
        tier = "healthy" if final_score >= 70 else "at_risk" if final_score >= 40 else "critical"
        
        trial_ends = sub.get("trialEndsAt") if sub else None
        days_to_expiry = None
        if trial_ends:
            if isinstance(trial_ends, str):
                trial_ends = datetime.fromisoformat(trial_ends.replace("Z", "+00:00"))
            days_to_expiry = (trial_ends - datetime.now(timezone.utc)).days
        
        scores.append({
            "id": t["_id"],
            "name": t["name"],
            "slug": t["slug"],
            "status": t["status"],
            "region": t.get("region"),
            "score": final_score,
            "tier": tier,
            "signals": {
                "logins7d": recent_logins,
                "students": student_count,
                "featuresUsed": len(entity_types),
                "subStatus": sub.get("status", "NONE") if sub else "NONE"
            },
            "trialEndsAt": trial_ends.isoformat() if isinstance(trial_ends, datetime) else trial_ends,
            "daysToExpiry": days_to_expiry,
            "createdAt": t["createdAt"].isoformat() if isinstance(t.get("createdAt"), datetime) else t.get("createdAt")
        })
    
    scores.sort(key=lambda x: x["score"])
    
    return {
        "scores": scores,
        "summary": {
            "healthy": len([s for s in scores if s["tier"] == "healthy"]),
            "at_risk": len([s for s in scores if s["tier"] == "at_risk"]),
            "critical": len([s for s in scores if s["tier"] == "critical"]),
            "avg": round(sum(s["score"] for s in scores) / max(len(scores), 1))
        }
    }


@app.get("/api/superadmin/trials")
async def get_trial_funnel(_: dict = Depends(require_superadmin)):
    trials = await db.subscriptions.find({"status": "TRIAL"}).to_list(1000)
    
    now = datetime.now(timezone.utc)
    result = []
    
    for sub in trials:
        tenant = await db.tenants.find_one({"_id": sub["tenantId"]})
        plan = await db.pricing_plans.find_one({"_id": sub.get("planId")})
        student_count = await db.students.count_documents({"tenantId": sub["tenantId"]})
        
        trial_ends = sub.get("trialEndsAt")
        days_left = None
        if trial_ends:
            if isinstance(trial_ends, str):
                trial_ends = datetime.fromisoformat(trial_ends.replace("Z", "+00:00"))
            days_left = (trial_ends - now).days
        
        urgency = "ok"
        if days_left is not None:
            if days_left <= 3:
                urgency = "critical"
            elif days_left <= 7:
                urgency = "warning"
        
        result.append({
            "tenantId": sub["tenantId"],
            "name": tenant.get("name") if tenant else "—",
            "slug": tenant.get("slug") if tenant else "—",
            "email": tenant.get("contactEmail") if tenant else "—",
            "students": student_count,
            "trialEndsAt": trial_ends.isoformat() if isinstance(trial_ends, datetime) else trial_ends,
            "daysLeft": days_left,
            "urgency": urgency,
            "planName": plan.get("name") if plan else "—",
            "createdAt": tenant.get("createdAt").isoformat() if tenant and isinstance(tenant.get("createdAt"), datetime) else None
        })
    
    return {
        "total": len(result),
        "expiring3d": len([r for r in result if r["urgency"] == "critical"]),
        "expiring7d": len([r for r in result if r["urgency"] == "warning"]),
        "list": result
    }


@app.get("/api/superadmin/cohorts")
async def get_cohort_data(_: dict = Depends(require_superadmin)):
    tenants = await db.tenants.find({}).to_list(10000)
    
    cohorts = {}
    for t in tenants:
        created = t.get("createdAt")
        if isinstance(created, datetime):
            month = created.strftime("%Y-%m")
        else:
            continue
        
        if month not in cohorts:
            cohorts[month] = {"total": 0, "active": 0, "churned": 0, "trial": 0}
        
        cohorts[month]["total"] += 1
        status = t.get("status", "TRIAL")
        if status == "ACTIVE":
            cohorts[month]["active"] += 1
        elif status in ["CANCELLED", "SUSPENDED"]:
            cohorts[month]["churned"] += 1
        else:
            cohorts[month]["trial"] += 1
    
    rows = []
    for month, data in sorted(cohorts.items()):
        rows.append({
            "month": month,
            **data,
            "retentionRate": round(data["active"] / max(data["total"], 1) * 100)
        })
    
    return {"cohorts": rows, "totalTenants": len(tenants)}


@app.get("/api/superadmin/monitoring")
async def get_system_monitoring(_: dict = Depends(require_superadmin)):
    now = datetime.now(timezone.utc)
    
    recent_signups = await db.tenants.count_documents({
        "createdAt": {"$gte": now - timedelta(days=1)}
    })
    
    recent_activity = await db.audit_logs.count_documents({
        "createdAt": {"$gte": now - timedelta(hours=1)}
    })
    
    tenant_counts = {}
    for status in ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]:
        tenant_counts[status] = await db.tenants.count_documents({"status": status})
    
    return {
        "services": {
            "database": "up",
            "redis": "configured",
            "storage": "configured"
        },
        "activity": {
            "recentSignups": recent_signups,
            "recentActivityLastHour": recent_activity
        },
        "tenantCounts": tenant_counts,
        "timestamp": now.isoformat()
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Health Check
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
