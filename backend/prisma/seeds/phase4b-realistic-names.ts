import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const maleNames = [
  'Aarav','Vivaan','Aditya','Krishna','Arjun',
  'Atharv','Rohan','Ayush','Mohit','Yash',
  'Kartik','Shivam','Ankit','Rahul','Saurabh',
  'Harsh','Lakshya','Pranav','Abhishek','Akash'
];

const femaleNames = [
  'Ananya','Aadhya','Diya','Kavya','Priya',
  'Sneha','Pooja','Riya','Muskan','Neha',
  'Sakshi','Ishita','Khushi','Nandini','Aarohi',
  'Simran','Tanvi','Rashmi','Shreya','Payal'
];

const surnames = [
  'Srivastava',
  'Sharma',
  'Verma',
  'Gupta',
  'Mishra',
  'Pandey',
  'Tripathi',
  'Tiwari',
  'Singh',
  'Jaiswal',
  'Agarwal',
  'Khan',
  'Ansari',
  'Siddiqui',
];

const fatherNames = [
  'Rajesh',
  'Amit',
  'Sanjay',
  'Manoj',
  'Deepak',
  'Sunil',
  'Rakesh',
  'Anil',
  'Ashok',
  'Pradeep',
  'Mukesh',
  'Vijay',
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function main() {
  console.log('\n🎭 Updating Student Names...\n');

  const students = await prisma.student.findMany({
    include: {
      guardianLinks: {
        include: {
          guardian: true,
        },
      },
    },
    orderBy: {
      admissionNumber: 'asc',
    },
  });

  console.log(`Found ${students.length} students`);

  let counter = 1;

  for (const student of students) {
    const gender = student.gender;

    const firstName =
      gender === 'FEMALE'
        ? randomItem(femaleNames)
        : randomItem(maleNames);

    const surname = randomItem(surnames);

    await prisma.student.update({
      where: {
        id: student.id,
      },
      data: {
        firstName,
        lastName: surname,
      },
    });

    for (const link of student.guardianLinks) {
      await prisma.guardian.update({
        where: {
          id: link.guardian.id,
        },
        data: {
          firstName: randomItem(fatherNames),
          lastName: surname,
        },
      });
    }

    if (counter % 50 === 0) {
      console.log(`Updated ${counter}/${students.length}`);
    }

    counter++;
  }

  console.log('\n✅ Student Names Updated');
  console.log('✅ Guardian Names Updated');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
