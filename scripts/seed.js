const { initDb, seedTasks } = require('../server/db');

(async () => {
  await initDb();
  await seedTasks();
  console.log('Seed complete');
  process.exit(0);
})();
