/**
 * SchoolOS — Demo Data Seed Script
 * Seeds realistic data for demo-school tenant:
 *   1 branch, 3 classes, 6 sections, 8 subjects
 *   10 staff members, 25 students with guardians
 *   30 days attendance, 20 library books, 5 book issues
 *   fee plans, invoices, 1 exam with marks
 *
 * Run: node prisma/seed-demo.js
 */

"use strict";
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const hash = (p) => bcrypt.hash(p, 10);

// ── Demo Data ─────────────────────────────────────────────────────────────────
const FIRST_NAMES = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Ayaan","Krishna","Ishaan","Diya","Ananya","Kavya","Aadhya","Saanvi","Anvi","Avni","Priya","Meera","Riya","Rahul","Rohan","Raj","Varun","Karan","Priya","Neha","Pooja","Sunita","Amit"];
const LAST_NAMES  = ["Sharma","Verma","Singh","Gupta","Patel","Kumar","Mishra","Joshi","Yadav","Tiwari","Srivastava","Pandey","Chauhan","Agarwal","Rao","Reddy","Nair","Menon","Iyer","Pillai"];
const SUBJECTS    = ["Mathematics","English","Hindi","Science","Social Studies","Computer Science","Physical Education","Art & Craft"];
const SUB_CODES   = ["MATH","ENG","HIN","SCI","SOC","CS","PE","ART"];
const DEPARTMENTS = ["Science","Mathematics","Languages","Social Studies","Physical Education","Administration"];
const DESIGNATIONS= ["Teacher","Senior Teacher","Head of Department","Assistant Teacher","Lab Assistant","Librarian","Physical Education Teacher","Computer Teacher"];
const BLOOD_GROUPS= ["A+","A-","B+","B-","O+","O-","AB+","AB-"];
const RELATIONS   = ["FATHER","MOTHER","GRANDFATHER","LEGAL_GUARDIAN"];
const BOOKS = [
  { title:"Mathematics Class 10", author:"R.D. Sharma",  publisher:"Dhanpat Rai", subject:"Mathematics", isbn:"9788193663660", copies:5 },
  { title:"Science NCERT Class 9", author:"NCERT",       publisher:"NCERT",       subject:"Science",     isbn:"9788174506276", copies:4 },
  { title:"English Literature",    author:"Various",     publisher:"Oxford",      subject:"English",     isbn:"9780198068723", copies:6 },
  { title:"Indian History",        author:"Bipan Chandra",publisher:"NCERT",      subject:"History",     isbn:"9788174505798", copies:3 },
  { title:"Geography Class 10",    author:"NCERT",       publisher:"NCERT",       subject:"Geography",   isbn:"9788174507273", copies:4 },
  { title:"Computer Science",      author:"Sumita Arora",publisher:"Dhanpat Rai", subject:"Computer",    isbn:"9788177000191", copies:5 },
  { title:"Physics Concepts",      author:"H.C. Verma",  publisher:"Bharati Bhawan",subject:"Physics",   isbn:"9788177091878", copies:3 },
  { title:"Chemistry NCERT",       author:"NCERT",       publisher:"NCERT",       subject:"Chemistry",   isbn:"9788174506689", copies:4 },
  { title:"Hindi Sahitya",         author:"Various",     publisher:"NCERT",       subject:"Hindi",       isbn:"9788174504463", copies:5 },
  { title:"Civics & Politics",     author:"NCERT",       publisher:"NCERT",       subject:"Civics",      isbn:"9788174507396", copies:3 },
  { title:"Biology Class 12",      author:"NCERT",       publisher:"NCERT",       subject:"Biology",     isbn:"9788174506306", copies:4 },
  { title:"Mathematics Advanced",  author:"S.L. Loney",  publisher:"Arihant",     subject:"Mathematics", isbn:"9789351415978", copies:2 },
  { title:"English Grammar",       author:"Wren & Martin",publisher:"S.Chand",    subject:"English",     isbn:"9789352530892", copies:6 },
  { title:"World Geography",       author:"Majid Husain",publisher:"McGraw Hill",  subject:"Geography",   isbn:"9789389951677", copies:2 },
  { title:"Indian Economy",        author:"Ramesh Singh",publisher:"McGraw Hill",  subject:"Economics",   isbn:"9789352603831", copies:3 },
  { title:"Organic Chemistry",     author:"O.P. Tandon", publisher:"G.R. Bathla",  subject:"Chemistry",   isbn:"9788183210454", copies:2 },
  { title:"Social Science Class 8",author:"NCERT",       publisher:"NCERT",       subject:"Social",      isbn:"9788174507570", copies:5 },
  { title:"Python Programming",    author:"Sumita Arora",publisher:"Dhanpat Rai", subject:"Computer",    isbn:"9789383524419", copies:4 },
  { title:"Moral Science",         author:"Various",     publisher:"Macmillan",   subject:"Moral",       isbn:"9780230328013", copies:3 },
  { title:"Sanskrit Primer",       author:"NCERT",       publisher:"NCERT",       subject:"Sanskrit",    isbn:"9788174506009", copies:3 },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱 SchoolOS Demo Seed — Starting...\n");

  // ── Find demo tenant ───────────────────────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({ where: { slug: "demo-school" } });
  if (!tenant) {
    console.error("❌ demo-school tenant not found. Run the main seed.js first.");
    process.exit(1);
  }
  console.log(`✓ Found tenant: ${tenant.name} (${tenant.id})`);

  const session = await prisma.academicSession.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
  });
  if (!session) {
    console.error("❌ No current academic session found. Run the main seed.js first.");
    process.exit(1);
  }
  console.log(`✓ Session: ${session.name}`);

  const adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "SCHOOL_ADMIN" },
  });

  // ── 1. Branch ─────────────────────────────────────────────────────────────
  console.log("\n1. Creating branch...");
  let branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId:   tenant.id,
        name:       "Main Campus",
        branchCode: "MAIN",
        address:    "12, Vidya Nagar, Near Civil Lines",
        city:       "Lucknow",
        phone:      "+91-0522-2345678",
        email:      "main@demo-school.com",
        principal:  "Dr. Ramesh Sharma",
        status:     "ACTIVE",
        isActive:   true,
        activatedAt: new Date(),
      },
    });
    console.log(`   ✓ Branch: ${branch.name}`);
  } else {
    console.log(`   Branch exists: ${branch.name}`);
  }

  // ── 2. Classes & Sections ──────────────────────────────────────────────────
  console.log("\n2. Creating classes and sections...");
  const classData = [
    { name: "Class 10", sections: ["A", "B"] },
    { name: "Class 11", sections: ["A", "B"] },
    { name: "Class 12", sections: ["A", "B"] },
  ];

  const createdClasses = [];
  for (const cd of classData) {
    let cls = await prisma.class.findFirst({
      where: { tenantId: tenant.id, sessionId: session.id, name: cd.name },
      include: { sections: true },
    });
    if (!cls) {
      cls = await prisma.class.create({
        data: {
          tenantId:  tenant.id,
          sessionId: session.id,
          name:      cd.name,
          isActive:  true,
        },
        include: { sections: true },
      });
      console.log(`   ✓ Class: ${cd.name}`);
    }
    // Create sections
    for (const secName of cd.sections) {
      const exists = cls.sections?.find((s) => s.name === secName);
      if (!exists) {
        await prisma.section.create({
          data: {
            tenantId: tenant.id,
            classId:  cls.id,
            name:     secName,
            capacity: 40,
            isActive: true,
          },
        });
        console.log(`      ✓ Section: ${cd.name} — ${secName}`);
      }
    }
    createdClasses.push(cls);
  }

  // Reload with sections
  const allClasses = await prisma.class.findMany({
    where: { tenantId: tenant.id, sessionId: session.id },
    include: { sections: true },
  });
  const allSections = allClasses.flatMap((c) => c.sections);

  // ── 3. Subjects ────────────────────────────────────────────────────────────
  console.log("\n3. Creating subjects...");
  const createdSubjects = [];
  for (let i = 0; i < SUBJECTS.length; i++) {
    let sub = await prisma.subject.findFirst({
      where: { tenantId: tenant.id, code: SUB_CODES[i] },
    });
    if (!sub) {
      sub = await prisma.subject.create({
        data: {
          tenantId: tenant.id,
          name:     SUBJECTS[i],
          code:     SUB_CODES[i],
        },
      });
      console.log(`   ✓ Subject: ${sub.name}`);
    }
    createdSubjects.push(sub);
  }

  // ── 4. Staff (10 members) ─────────────────────────────────────────────────
  console.log("\n4. Creating staff members...");
  const staffData = [
    { firstName:"Rajesh",   lastName:"Sharma",   email:"rajesh.sharma@demo-school.com",   designation:"Head of Department",  dept:"Mathematics",        empId:"EMP001" },
    { firstName:"Sunita",   lastName:"Verma",    email:"sunita.verma@demo-school.com",    designation:"Senior Teacher",      dept:"Science",            empId:"EMP002" },
    { firstName:"Amit",     lastName:"Kumar",    email:"amit.kumar@demo-school.com",      designation:"Teacher",             dept:"Languages",          empId:"EMP003" },
    { firstName:"Priya",    lastName:"Singh",    email:"priya.singh@demo-school.com",     designation:"Teacher",             dept:"Social Studies",     empId:"EMP004" },
    { firstName:"Deepak",   lastName:"Gupta",    email:"deepak.gupta@demo-school.com",    designation:"Computer Teacher",    dept:"Mathematics",        empId:"EMP005" },
    { firstName:"Kavita",   lastName:"Patel",    email:"kavita.patel@demo-school.com",    designation:"Teacher",             dept:"Languages",          empId:"EMP006" },
    { firstName:"Suresh",   lastName:"Yadav",    email:"suresh.yadav@demo-school.com",    designation:"Physical Education Teacher", dept:"Physical Education", empId:"EMP007" },
    { firstName:"Anita",    lastName:"Mishra",   email:"anita.mishra@demo-school.com",    designation:"Assistant Teacher",   dept:"Science",            empId:"EMP008" },
    { firstName:"Vikram",   lastName:"Joshi",    email:"vikram.joshi@demo-school.com",    designation:"Librarian",           dept:"Administration",     empId:"EMP009" },
    { firstName:"Meena",    lastName:"Tiwari",   email:"meena.tiwari@demo-school.com",    designation:"Teacher",             dept:"Mathematics",        empId:"EMP010" },
  ];

  const createdStaff = [];
  for (const sd of staffData) {
    let user = await prisma.user.findFirst({
      where: { email: sd.email, tenantId: tenant.id },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId:        tenant.id,
          email:           sd.email,
          passwordHash:    await hash("Staff@1234!"),
          firstName:       sd.firstName,
          lastName:        sd.lastName,
          role:            "TEACHER",
          isActive:        true,
          isEmailVerified: true,
          phone:           `+91${rand(7000000000, 9999999999)}`,
        },
      });
    }
    let profile = await prisma.staffProfile.findFirst({
      where: { tenantId: tenant.id, employeeId: sd.empId },
    });
    if (!profile) {
      profile = await prisma.staffProfile.create({
        data: {
          tenantId:      tenant.id,
          userId:        user.id,
          employeeId:    sd.empId,
          designation:   sd.designation,
          department:    sd.dept,
          dateOfJoining: new Date(`${new Date().getFullYear() - rand(1,5)}-${String(rand(1,12)).padStart(2,"0")}-01`),
          dateOfBirth:   new Date(`${1970 + rand(0,20)}-${String(rand(1,12)).padStart(2,"0")}-${String(rand(1,28)).padStart(2,"0")}`),
          gender:        pick(["MALE","FEMALE"]),
          qualification: pick(["B.Ed","M.Ed","M.Sc","M.A","B.Sc","MBA"]),
          experience:    rand(1, 15),
          isActive:      true,
        },
      });
      console.log(`   ✓ Staff: ${sd.firstName} ${sd.lastName} (${sd.empId})`);
    }
    createdStaff.push({ user, profile });
  }

  // ── 5. Students (25) ──────────────────────────────────────────────────────
  console.log("\n5. Creating students...");
  const createdStudents = [];
  let admCount = 1;

  for (let i = 0; i < 25; i++) {
    const firstName   = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName    = pick(LAST_NAMES);
    const admNo       = `DMS-2025-${String(admCount++).padStart(3,"0")}`;
    const section     = allSections[i % allSections.length];
    const dob         = new Date(`${2005 + rand(0,5)}-${String(rand(1,12)).padStart(2,"0")}-${String(rand(1,28)).padStart(2,"0")}`);

    let student = await prisma.student.findFirst({
      where: { tenantId: tenant.id, admissionNumber: admNo },
    });
    if (!student) {
      student = await prisma.student.create({
        data: {
          tenantId:        tenant.id,
          branchId:        branch.id,
          admissionNumber: admNo,
          firstName,
          lastName,
          dateOfBirth:     dob,
          gender:          pick(["MALE","FEMALE"]),
          bloodGroup:      pick(BLOOD_GROUPS),
          sectionId:       section.id,
          academicYear:    session.id,
          rollNumber:      String(rand(1, 60)),
          isActive:        true,
          phone:           `+91${rand(7000000000, 9999999999)}`,
          address: {
            addressLine: `${rand(1,100)}, ${pick(["Gandhi Nagar","Nehru Colony","Lal Bagh","Hazratganj","Gomti Nagar"])}`,
            city:        "Lucknow",
            state:       "Uttar Pradesh",
            pincode:     `226${rand(100,999)}`,
          },
        },
      });

      // Guardian
      const gPhone = `+91${rand(7000000000, 9999999999)}`;
      const guardian = await prisma.guardian.create({
        data: {
          tenantId:  tenant.id,
          firstName: pick(FIRST_NAMES),
          lastName,
          phone:     gPhone,
          email:     `parent.${admNo.toLowerCase()}@gmail.com`,
          occupation: pick(["Business","Government Service","Private Job","Farmer","Self Employed"]),
          isActive:  true,
        },
      });
      await prisma.guardianStudent.create({
        data: {
          guardianId: guardian.id,
          studentId:  student.id,
          relation:   pick(RELATIONS),
          isPrimary:  true,
        },
      });
      console.log(`   ✓ Student: ${firstName} ${lastName} (${admNo}) → ${section.name}`);
    }
    createdStudents.push(student);
  }

  // ── 6. Attendance (last 30 school days) ───────────────────────────────────
  console.log("\n6. Creating attendance records...");
  const today = new Date();
  let attCount = 0;
  const schoolDays = [];
  for (let d = 30; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    if (date.getDay() !== 0 && date.getDay() !== 6) schoolDays.push(date); // skip weekends
  }

  for (const student of createdStudents.slice(0, 20)) { // first 20 students
    for (const date of schoolDays.slice(0, 20)) {       // last 20 school days
      const dateOnly = new Date(date.toISOString().split("T")[0]);
      const existing = await prisma.attendance.findFirst({
        where: { tenantId: tenant.id, studentId: student.id, date: dateOnly, period: null },
      });
      if (!existing) {
        const roll = Math.random();
        await prisma.attendance.create({
          data: {
            tenantId:  tenant.id,
            studentId: student.id,
            sessionId: session.id,
            date:      dateOnly,
            status:    roll > 0.15 ? "PRESENT" : roll > 0.08 ? "LATE" : "ABSENT",
            markedBy:  adminUser?.id ?? "system",
          },
        });
        attCount++;
      }
    }
  }
  console.log(`   ✓ ${attCount} attendance records created`);

  // ── 7. Library Books (20) ─────────────────────────────────────────────────
  console.log("\n7. Creating library books...");
  const createdBooks = [];
  for (const b of BOOKS) {
    let book = await prisma.book.findFirst({
      where: { tenantId: tenant.id, isbn: b.isbn },
    });
    if (!book) {
      book = await prisma.book.create({
        data: {
          tenantId:       tenant.id,
          isbn:           b.isbn,
          title:          b.title,
          author:         b.author,
          publisher:      b.publisher,
          subject:        b.subject,
          totalCopies:    b.copies,
          availableCopies: b.copies - 1,
          location:       `Shelf ${pick(["A","B","C","D"])}-${rand(1,10)}`,
        },
      });
      console.log(`   ✓ Book: ${b.title}`);
    }
    createdBooks.push(book);
  }

  // ── 8. Book Issues (5) ────────────────────────────────────────────────────
  console.log("\n8. Issuing books to students...");
  for (let i = 0; i < 5; i++) {
    const book    = createdBooks[i];
    const student = createdStudents[i];
    const issued  = await prisma.bookIssue.findFirst({
      where: { tenantId: tenant.id, bookId: book.id, studentId: student.id, status: "ISSUED" },
    });
    if (!issued) {
      const issueDate = new Date();
      issueDate.setDate(issueDate.getDate() - rand(1, 10));
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + rand(5, 14));
      await prisma.bookIssue.create({
        data: {
          tenantId:  tenant.id,
          bookId:    book.id,
          studentId: student.id,
          issuedAt:  issueDate,
          dueDate,
          status:    "ISSUED",
          issuedBy:  adminUser?.id ?? "system",
        },
      });
      console.log(`   ✓ Issued: "${book.title}" → ${student.firstName} ${student.lastName}`);
    }
  }

  // ── 9. Fee Plan + Invoices ────────────────────────────────────────────────
  console.log("\n9. Creating fee plan and invoices...");
  let feePlan = await prisma.feePlan.findFirst({
    where: { tenantId: tenant.id, name: "Annual Fee 2025-26" },
  });
  if (!feePlan) {
    feePlan = await prisma.feePlan.create({
      data: {
        tenantId:     tenant.id,
        sessionId:    session.id,
        name:         "Annual Fee 2025-26",
        academicYear: session.name,
        currency:     "INR",
        isActive:     true,
        feeItems: {
          create: [
            { name: "Tuition Fee",     amount: 8000,  isOptional: false },
            { name: "Library Fee",     amount: 500,   isOptional: false },
            { name: "Sports Fee",      amount: 500,   isOptional: false },
            { name: "Lab Fee",         amount: 1000,  isOptional: false },
            { name: "Exam Fee",        amount: 500,   isOptional: false },
          ],
        },
      },
    });
    console.log("   ✓ Fee plan: Annual Fee 2025-26 (₹10,500)");
  }

  // Create invoices for first 15 students
  let invoiceCount = 0;
  const year = new Date().getFullYear();
  for (let i = 0; i < 15; i++) {
    const student = createdStudents[i];
    const exists  = await prisma.invoice.findFirst({
      where: { tenantId: tenant.id, studentId: student.id },
    });
    if (!exists) {
      const count  = await prisma.invoice.count({ where: { tenantId: tenant.id } });
      const invNo  = `INV-${year}-${String(count + 1).padStart(5,"0")}`;
      const status = i < 8 ? "PAID" : i < 12 ? "PARTIALLY_PAID" : "SENT";
      const total  = 10500;
      const paid   = status === "PAID" ? total : status === "PARTIALLY_PAID" ? rand(2000, 8000) : 0;
      const due    = new Date(); due.setDate(due.getDate() + rand(-10, 30));

      await prisma.invoice.create({
        data: {
          tenantId:      tenant.id,
          studentId:     student.id,
          invoiceNumber: invNo,
          academicYear:  session.name,
          status:        status,
          currency:      "INR",
          subtotal:      total,
          totalAmount:   total,
          paidAmount:    paid,
          dueAmount:     total - paid,
          dueDate:       due,
          items: {
            create: [
              { name: "Tuition Fee", amount: 8000, netAmount: 8000 },
              { name: "Library Fee", amount: 500,  netAmount: 500  },
              { name: "Sports Fee",  amount: 500,  netAmount: 500  },
              { name: "Lab Fee",     amount: 1000, netAmount: 1000 },
              { name: "Exam Fee",    amount: 500,  netAmount: 500  },
            ],
          },
        },
      });
      invoiceCount++;
    }
  }
  console.log(`   ✓ ${invoiceCount} invoices created (8 paid, 4 partial, 3 pending)`);

  // ── 10. Exam ──────────────────────────────────────────────────────────────
  console.log("\n10. Creating exam...");
  let exam = await prisma.exam.findFirst({
    where: { tenantId: tenant.id, name: "Mid Term Examination 2025" },
  });
  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        tenantId:    tenant.id,
        sessionId:   session.id,
        name:        "Mid Term Examination 2025",
        startDate:   new Date(`${year}-09-01`),
        endDate:     new Date(`${year}-09-15`),
        type:        "MID_TERM",
      },
    });
    console.log("   ✓ Exam: Mid Term Examination 2025");
  }

  // ── 11. Announcements ─────────────────────────────────────────────────────
  console.log("\n11. Creating announcements...");
  const announcements = [
    { title: "Mid Term Results Declared", body: "Mid term examination results have been declared. Students can check their results on the portal. Parents are requested to attend the parent-teacher meeting scheduled on 25th October.", isPinned: true },
    { title: "Annual Sports Day", body: "Annual Sports Day will be held on 15th November 2025. All students must participate. Practice sessions start from 1st November. Contact the sports teacher for more details.", isPinned: true },
    { title: "Fee Payment Reminder", body: "Last date for fee payment is 30th October 2025. Students with pending fees may not be allowed to appear in final exams. Please pay at the school office or via online transfer.", isPinned: false },
    { title: "Winter Uniform From November", body: "From 1st November, all students are required to wear winter uniform. The school uniform shop will be open every Saturday from 9 AM to 1 PM.", isPinned: false },
    { title: "Library Books Return", body: "All library books must be returned by 31st October. Fine of ₹2 per day will be charged for late returns. Books in damaged condition will attract replacement charges.", isPinned: false },
  ];
  for (const ann of announcements) {
    const exists = await prisma.announcement.findFirst({
      where: { tenantId: tenant.id, title: ann.title },
    });
    if (!exists) {
      await prisma.announcement.create({
        data: {
          tenantId:    tenant.id,
          title:       ann.title,
          body:        ann.body,
          isPinned:    ann.isPinned,
          publishedAt: new Date(),
          createdBy:   adminUser?.id ?? "system",
        },
      });
      console.log(`   ✓ Announcement: ${ann.title}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("✅ Demo seed complete!\n");
  console.log("Created:");
  console.log(`  • 1 branch (Main Campus)`);
  console.log(`  • 3 classes × 2 sections = 6 sections`);
  console.log(`  • ${SUBJECTS.length} subjects`);
  console.log(`  • 10 staff members (password: Staff@1234!)`);
  console.log(`  • 25 students with guardians`);
  console.log(`  • ~${attCount} attendance records (20 students × 20 days)`);
  console.log(`  • 20 library books, 5 issued`);
  console.log(`  • 1 fee plan (₹10,500), 15 invoices`);
  console.log(`  • 1 exam (Mid Term 2025)`);
  console.log(`  • 5 announcements`);
  console.log("\nLogin: admin@demo-school.com / Demo@1234!");
  console.log("─".repeat(60) + "\n");
}

main()
  .catch((e) => { console.error("\n❌ Demo seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
