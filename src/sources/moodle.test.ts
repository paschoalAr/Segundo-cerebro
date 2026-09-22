import { describe, expect, it } from 'vitest';
import { dropAssignDuplicates, mapMoodleAssignmentsToFacts, mapMoodleUpcomingToFacts } from './moodle';

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

describe('dropAssignDuplicates', () => {
  it('remove o evento genérico de uma entrega que já veio pelo mod_assign (instance = cmid, não o id da entrega)', () => {
    const events: Parameters<typeof dropAssignDuplicates>[0] = [
      {
        id: 98078474,
        name: 'Entrega do T1 está marcado(a) para esta data',
        timestart: 1758560400,
        timeduration: 0,
        eventtype: 'due',
        course: { fullname: 'Sistemas Distribuídos' },
        modulename: 'assign',
        instance: 3783141, // cmid, não o id=217843 da entrega em mod_assign_get_assignments
      },
    ];
    expect(dropAssignDuplicates(events, new Set([3783141]))).toEqual([]);
  });

  it('mantém eventtype=due que não vem de uma entrega (ex.: escolha de grupo)', () => {
    const events: Parameters<typeof dropAssignDuplicates>[0] = [
      {
        id: 2,
        name: 'Escolha seu grupo (Data limite)',
        timestart: 1758560400,
        timeduration: 0,
        eventtype: 'due',
        course: { fullname: 'Cultura Digital' },
        modulename: 'choicegroup',
        instance: 999,
      },
    ];
    expect(dropAssignDuplicates(events, new Set([3783141]))).toEqual(events);
  });

  it('mantém eventos sem modulename/instance (formato antigo/incompleto)', () => {
    const events: Parameters<typeof dropAssignDuplicates>[0] = [
      { id: 3, name: 'x', timestart: 1758560400, timeduration: 0, eventtype: 'due', course: null },
    ];
    expect(dropAssignDuplicates(events, new Set([3783141]))).toEqual(events);
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
            { id: 100, cmid: 200, name: 'TPP1', duedate: 1758560400 },
            { id: 101, cmid: 201, name: 'Sem prazo', duedate: 0 },
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
