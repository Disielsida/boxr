'use strict';
// Генерирует расписание для IN_PROGRESS турниров
// Запуск: node scripts/seed-schedules.js

const { PrismaClient } = require('@prisma/client');
const { planSchedule } = require('../dist/matches/schedule-builder');

const db = new PrismaClient();

async function main() {
  const tournaments = await db.tournament.findMany({
    where: { status: 'IN_PROGRESS' },
    select: {
      id: true, name: true,
      dateStart: true, dateEnd: true,
      ringCount: true, dayStartTime: true, slotMinutes: true,
      minRestMinutes: true, rounds: true, roundDuration: true,
    },
  });

  for (const t of tournaments) {
    console.log(`\n─── ${t.name} ───`);

    const matches = await db.match.findMany({
      where: { tournamentId: t.id },
      select: {
        id: true, category: true, round: true, position: true,
        redBoxerId: true, blueBoxerId: true, status: true,
        prevMatches: { select: { id: true } },
      },
    });

    // planSchedule ожидает массив с полем prevMatchIds
    const input = matches.map((m) => ({
      id: m.id,
      category: m.category,
      round: m.round,
      position: m.position,
      redBoxerId: m.redBoxerId,
      blueBoxerId: m.blueBoxerId,
      prevMatchIds: m.prevMatches.map((p) => p.id),
    }));

    const dateStart = t.dateStart.toISOString().slice(0, 10);
    const dateEnd = t.dateEnd.toISOString().slice(0, 10);
    const matchDuration = t.rounds * t.roundDuration + t.rounds; // раунды + перерывы ~1мин

    const result = planSchedule(input, {
      dateStart,
      dateEnd,
      dayStartTime: t.dayStartTime,
      dayEndTime: '20:00',
      ringCount: t.ringCount,
      slotMinutes: t.slotMinutes,
      minRestMinutes: t.minRestMinutes,
      matchDuration,
    });

    if (result.error) {
      console.log(`  Ошибка: ${result.error}`);
      continue;
    }

    // Применяем только к не-завершённым матчам
    let updated = 0;
    for (const a of result.assignments) {
      const match = matches.find((m) => m.id === a.matchId);
      if (match && match.status !== 'COMPLETED') {
        await db.match.update({
          where: { id: a.matchId },
          data: { scheduledAt: new Date(a.scheduledAt), ring: a.ring },
        });
        updated++;
      }
    }
    console.log(`  Назначено слотов: ${updated} из ${result.assignments.length}`);
  }

  console.log('\n✓ Расписания сгенерированы.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
