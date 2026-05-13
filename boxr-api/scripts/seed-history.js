'use strict';
// Скрипт сидинга: заявки, сетки, результаты матчей
// Запуск: node scripts/seed-history.js

const { PrismaClient } = require('@prisma/client');
const { buildCategoryBracket } = require('../dist/matches/bracket-builder');

const db = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

const OUTCOMES = ['WP', 'WP', 'WP', 'KO', 'RSC', 'WP', 'WP', 'KO'];
function pickOutcome() { return pick(OUTCOMES); }

function randEndRound(rounds) {
  return Math.ceil(Math.random() * rounds);
}

// ─── данные из БД ────────────────────────────────────────────────────────────

async function loadData() {
  const tournaments = await db.tournament.findMany({
    select: {
      id: true, name: true, status: true, categories: true, rounds: true,
      organizerId: true,
    },
  });

  const boxers = await db.boxer.findMany({
    select: { id: true, fullName: true, weight: true, trainerId: true },
  });

  // группируем боксёров по весу
  const byWeight = {};
  for (const b of boxers) {
    if (!byWeight[b.weight]) byWeight[b.weight] = [];
    byWeight[b.weight].push(b);
  }

  return { tournaments, boxers, byWeight };
}

// ─── создание заявок ────────────────────────────────────────────────────────

async function createApplications(tournament, byWeight, mode) {
  // mode: 'all_approved' | 'mixed'
  const appData = [];

  for (const cat of tournament.categories) {
    const available = byWeight[cat] || [];
    if (available.length === 0) continue;

    // Для 67кг ограничиваем количество участников чтобы не было слишком много
    let participants;
    if (mode === 'all_approved') {
      participants = available.length <= 8 ? available : pickN(available, 8);
    } else {
      // PUBLISHED: берём немного, разные статусы
      participants = available.length <= 6 ? available : pickN(available, 6);
    }

    for (const boxer of participants) {
      let status, decidedAt;
      if (mode === 'all_approved') {
        status = 'APPROVED';
        decidedAt = new Date(Date.now() - Math.random() * 30 * 86400000);
      } else {
        const r = Math.random();
        if (r < 0.55) {
          status = 'APPROVED';
          decidedAt = new Date(Date.now() - Math.random() * 10 * 86400000);
        } else if (r < 0.75) {
          status = 'REJECTED';
          decidedAt = new Date(Date.now() - Math.random() * 10 * 86400000);
        } else {
          status = 'PENDING';
          decidedAt = null;
        }
      }

      appData.push({
        boxerId: boxer.id,
        tournamentId: tournament.id,
        category: cat,
        status,
        trainerId: boxer.trainerId,
        decidedAt,
        createdAt: new Date(Date.now() - Math.random() * 45 * 86400000),
      });
    }
  }

  if (appData.length === 0) return [];

  // Вставляем по одной из-за unique constraint (boxerId, tournamentId)
  const created = [];
  for (const data of appData) {
    try {
      const app = await db.application.create({ data });
      created.push(app);
    } catch {
      // skip duplicates
    }
  }
  return created;
}

// ─── создание матчей (сетка) ─────────────────────────────────────────────────

async function createBracketMatches(tournament, approvedApps, completeAll, completeRatio) {
  // Группируем одобренные заявки по категориям
  const byCategory = {};
  for (const app of approvedApps) {
    if (!byCategory[app.category]) byCategory[app.category] = [];
    byCategory[app.category].push(app.boxerId);
  }

  const allMatchIds = []; // для возврата

  for (const [catStr, boxerIds] of Object.entries(byCategory)) {
    const category = parseFloat(catStr);
    if (boxerIds.length === 0) continue;

    // Генерируем структуру сетки
    const bracketMatches = buildCategoryBracket(boxerIds);
    if (bracketMatches.length === 0) continue;

    // Создаём матчи в БД — сначала без nextMatchId (разрешим позже)
    const dbMatches = [];
    for (const m of bracketMatches) {
      const created = await db.match.create({
        data: {
          tournamentId: tournament.id,
          category,
          round: m.round,
          position: m.position,
          redBoxerId: m.redBoxerId,
          blueBoxerId: m.blueBoxerId,
          status: 'PENDING',
          createdAt: new Date(Date.now() - Math.random() * 20 * 86400000),
        },
      });
      dbMatches.push({ db: created, bracket: m });
    }

    // Создаём индекс round:position → dbId
    const idx = {};
    for (const { db: dbM, bracket: bm } of dbMatches) {
      idx[`${bm.round}:${bm.position}`] = dbM.id;
    }

    // Линкуем nextMatchId
    for (const { db: dbM, bracket: bm } of dbMatches) {
      if (bm.nextRef) {
        const nextId = idx[`${bm.nextRef.round}:${bm.nextRef.position}`];
        if (nextId) {
          await db.match.update({
            where: { id: dbM.id },
            data: { nextMatchId: nextId },
          });
        }
      }
    }

    // Теперь проставляем результаты — обрабатываем раунды по порядку
    const maxRound = Math.max(...bracketMatches.map((m) => m.round));

    // Словарь winnerId по round:position — для прогрессии в финальных/полуфинальных матчах
    const winnerByPos = {};

    for (let r = 1; r <= maxRound; r++) {
      const roundMatches = dbMatches.filter(({ bracket }) => bracket.round === r);

      for (const { db: dbM, bracket: bm } of roundMatches) {
        // Если это bye (только один боксёр) — уже COMPLETED WO из bracket-builder
        if (bm.outcome === 'WO' && bm.winnerId) {
          await db.match.update({
            where: { id: dbM.id },
            data: {
              status: 'COMPLETED',
              outcome: 'WO',
              winnerId: bm.winnerId,
              decidedAt: new Date(Date.now() - Math.random() * 15 * 86400000),
            },
          });
          winnerByPos[`${r}:${bm.position}`] = bm.winnerId;
          continue;
        }

        // Определяем участников: для r>1 — победители предыдущего раунда
        let redId = bm.redBoxerId;
        let blueId = bm.blueBoxerId;

        // Если из предыдущего раунда должны прийти участники
        if (r > 1) {
          const prevRoundMatches = dbMatches.filter(
            ({ bracket }) => bracket.round === r - 1 && bracket.nextRef &&
              bracket.nextRef.round === r && bracket.nextRef.position === bm.position,
          );
          for (const prev of prevRoundMatches) {
            const w = winnerByPos[`${r - 1}:${prev.bracket.position}`];
            if (w) {
              if (prev.bracket.nextRef.slot === 'RED') redId = w;
              else blueId = w;
            }
          }
        }

        // Обновляем участников матча
        if (redId !== dbM.redBoxerId || blueId !== dbM.blueBoxerId) {
          await db.match.update({
            where: { id: dbM.id },
            data: { redBoxerId: redId, blueBoxerId: blueId },
          });
        }

        const shouldComplete = completeAll ||
          (completeRatio !== undefined && Math.random() < completeRatio);

        if (!redId && !blueId) {
          // Пустой матч — оставляем PENDING
          continue;
        }

        if (!redId || !blueId) {
          // Один боксёр — WO
          const winner = redId || blueId;
          await db.match.update({
            where: { id: dbM.id },
            data: {
              status: 'COMPLETED',
              outcome: 'WO',
              winnerId: winner,
              redBoxerId: redId,
              blueBoxerId: blueId,
              decidedAt: new Date(Date.now() - Math.random() * 15 * 86400000),
            },
          });
          winnerByPos[`${r}:${bm.position}`] = winner;
        } else if (shouldComplete) {
          const winner = Math.random() < 0.5 ? redId : blueId;
          const outcome = pickOutcome();
          const endRound = outcome === 'WP' ? tournament.rounds : randEndRound(tournament.rounds);
          await db.match.update({
            where: { id: dbM.id },
            data: {
              status: 'COMPLETED',
              outcome,
              winnerId: winner,
              redBoxerId: redId,
              blueBoxerId: blueId,
              endRound,
              decidedAt: new Date(Date.now() - Math.random() * 15 * 86400000),
            },
          });
          winnerByPos[`${r}:${bm.position}`] = winner;
        } else {
          // READY — участники назначены, бой не проведён
          await db.match.update({
            where: { id: dbM.id },
            data: {
              status: 'READY',
              redBoxerId: redId,
              blueBoxerId: blueId,
            },
          });
        }
      }
    }

    allMatchIds.push(...dbMatches.map(({ db: d }) => d.id));
  }

  return allMatchIds;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const { tournaments, byWeight } = await loadData();

  for (const t of tournaments) {
    console.log(`\n─── ${t.name} [${t.status}] ───`);

    if (t.status === 'FINISHED') {
      // Все заявки одобрены, все матчи завершены
      const apps = await createApplications(t, byWeight, 'all_approved');
      console.log(`  Applications: ${apps.length}`);
      const approved = apps.filter((a) => a.status === 'APPROVED');
      await createBracketMatches(t, approved, true, undefined);
      console.log(`  Bracket built with all matches COMPLETED`);
    } else if (t.status === 'IN_PROGRESS') {
      // Все заявки одобрены, ~60% матчей завершены
      const apps = await createApplications(t, byWeight, 'all_approved');
      console.log(`  Applications: ${apps.length}`);
      const approved = apps.filter((a) => a.status === 'APPROVED');
      await createBracketMatches(t, approved, false, 0.6);
      console.log(`  Bracket built with ~60% matches COMPLETED`);
    } else if (t.status === 'PUBLISHED') {
      // Смешанные статусы заявок, матчи только для одобренных (но не строим сетку — турнир ещё не начался)
      const apps = await createApplications(t, byWeight, 'mixed');
      console.log(`  Applications: ${apps.length} (mixed statuses, no bracket yet)`);
    }
  }

  // Итог
  const appCount = await db.application.count();
  const matchCount = await db.match.count();
  console.log(`\n✓ Done. Total applications: ${appCount}, matches: ${matchCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
