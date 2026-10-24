const prisma = require("./src/config/prisma");

async function main() {
  const trains = await prisma.train.findMany();

  console.log("CURRENT TRAINS");
  console.log(JSON.stringify(trains, null, 2));
}

main()
  .catch((error) => {
    console.error("ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });