import { describe, expect, it } from 'vitest';
import { mapMoodleAssignmentsToFacts, mapMoodleUpcomingToFacts } from './moodle';

describe('mapMoodleUpcomingToFacts', () => {
  it('mapeia eventos do calendário, incluindo o nome da cadeira no título', () => {
    const facts = mapMoodleUpcomingToFacts([
      { id: 1, name: 'Prova P1', timestart: 1758560400, timeduration: 3600, eventtype: 'due', course: { fullname: 'Redes Avançadas' } },
    ]);
    expect(facts).toEqual([
      {
        kind: 'event',
        title: 'Prova P1 (Redes Avançadas)',
        date: new Date(1758560400 * 1000),
        endDate: new Date((1758560400 + 3600) * 1000),
        allDay: false,
        source: 'moodle',
        sourceRef: 'event-1',
        meta: { eventtype: 'due' },
      },
    ]);
  });

  it('ignora eventos sem timestart', () => {
    expect(mapMoodleUpcomingToFacts([{ id: 2, name: 'x', timestart: 0, timeduration: 0, eventtype: 'other', course: null }])).toEqual([]);
  });

  it('evento pontual (com timestart, sem timeduration) fica com endDate null', () => {
    const facts = mapMoodleUpcomingToFacts([
      { id: 3, name: 'Entrega', timestart: 1758560400, timeduration: 0, eventtype: 'due', course: null },
    ]);
    expect(facts[0].endDate).toBeNull();
  });
});

describe('mapMoodleAssignmentsToFacts', () => {
  it('mapeia entregas com prazo, ignora as sem prazo (duedate=0)', () => {
    const facts = mapMoodleAssignmentsToFacts({
      courses: [
        {
          id: 10,
          fullname: 'Computação Paralela',
          assignments: [
            { id: 100, name: 'TPP1', duedate: 1758560400 },
            { id: 101, name: 'Sem prazo', duedate: 0 },
          ],
        },
      ],
    });
    expect(facts).toEqual([
      {
        kind: 'deadline',
        title: 'TPP1 (Computação Paralela)',
        date: new Date(1758560400 * 1000),
        endDate: null,
        allDay: false,
        source: 'moodle',
        sourceRef: 'assign-100',
        meta: { courseId: 10 },
      },
    ]);
  });
});
