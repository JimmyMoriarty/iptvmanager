// =====================================================
// CLI - Create Admin User
// =====================================================
// Usage: npx ts-node src/cli/create-admin.ts
// Or in Docker: docker compose exec api node dist/cli/create-admin.js
// =====================================================

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as readline from 'readline';

const prisma = new PrismaClient();

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  console.log('=============================================');
  console.log('  IPTV Manager - Create Admin User');
  console.log('=============================================\n');

  const username = await prompt('Username: ');
  if (!username || username.length < 3) {
    console.error('Username must be at least 3 characters');
    process.exit(1);
  }

  const email = await prompt('Email: ');
  if (!email || !email.includes('@')) {
    console.error('Invalid email address');
    process.exit(1);
  }

  const password = await prompt('Password (min 12 chars): ');
  if (!password || password.length < 12) {
    console.error('Password must be at least 12 characters');
    process.exit(1);
  }

  // Check if user exists
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  if (existing) {
    console.error('User with this username or email already exists');
    process.exit(1);
  }

  // Create user
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const passwordHash = await bcrypt.hash(password, rounds);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('\n✅ Admin user created successfully!');
  console.log(`   ID: ${user.id}`);
  console.log(`   Username: ${user.username}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ADMIN`);
  console.log('\n⚠️  You will need to set up 2FA on first login.\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
