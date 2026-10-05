import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/lib/security';
const prisma = new PrismaClient();
async function seed() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error('Set DEMO_PASSWORD to at least 12 characters.');
  const roles = Object.values(Role);
  for (const role of roles) await prisma.user.upsert({ where: { email: `${role}@apparelflow.demo` }, update: { passwordHash: hashPassword(password) }, create: { email: `${role}@apparelflow.demo`, role, fullName: role.replaceAll('_', ' '), passwordHash: hashPassword(password) } });
  const recipes = [
    { recipeCode: 'REC-BL01', name: 'Casual Blouse', category: 'Blouse', stdFabricYards: '1.8', wastageCap: '5', components: [['Front Body Panel',1],['Back Body Panel',1],['Sleeves (Left & Right)',2],['Collar & Stand',1],['Sleeve Cuffs',2]] },
    { recipeCode: 'REC-CT02', name: 'Crop Top', category: 'Crop Top', stdFabricYards: '1.1', wastageCap: '8', components: [['Front Chest Panel',1],['Back Support Panel',1],['Neck Binding Strip',1],['Hem Elastic Casing',1],['Side Strap Accents',2]] }
  ];
  for (const { components, ...recipe } of recipes) await prisma.recipe.upsert({ where: { recipeCode: recipe.recipeCode }, update: {}, create: { ...recipe, components: { create: components.map(([componentName,piecesPerGarment]) => ({ componentName: String(componentName), piecesPerGarment: Number(piecesPerGarment) })) } } });
}
seed().then(() => console.log('Seed complete. Three demo accounts and two recipes are ready.')).finally(() => prisma.$disconnect());
