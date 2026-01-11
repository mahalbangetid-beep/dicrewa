const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    // Set all users to 'user' role first
    await prisma.user.updateMany({
        data: { role: 'user' }
    });
    console.log('All users set to role: user');

    // Set the specific user to admin
    const adminUser = await prisma.user.update({
        where: { email: 'mahalbangetid@gmail.com' },
        data: { role: 'admin' }
    });
    console.log(`User ${adminUser.email} set to role: admin`);

    // List all users
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true }
    });
    console.log('\nCurrent users:');
    console.table(users);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
