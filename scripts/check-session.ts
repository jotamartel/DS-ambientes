import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const sessions = await prisma.session.findMany();
  console.log(`Sessions: ${sessions.length}`);
  for (const s of sessions) {
    console.log({
      id: s.id,
      shop: s.shop,
      isOnline: s.isOnline,
      hasAccessToken: !!s.accessToken,
      scope: s.scope,
    });
  }
}
main().finally(() => prisma.$disconnect());
