const job = require('../src/jobs/autoMealAttendance');
const db = require('../src/prismaClient');

if (require.main === module) {
    const customDate = process.argv[2] || null;
    job.runAutoMealAttendance(customDate)
        .then(result => {
            console.log('[AutoMealAttendance CLI] Finished:', JSON.stringify(result, null, 2));
            return db.pool.end();
        })
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[AutoMealAttendance CLI] Error:', err);
            db.pool.end().finally(() => process.exit(1));
        });
}

module.exports = job;
