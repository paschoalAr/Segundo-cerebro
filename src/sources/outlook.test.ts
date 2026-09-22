import { describe, expect, it } from 'vitest';
import { mapIcsToFacts } from './outlook';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:evt-123@outlook.com
DTSTAMP:20260920T120000Z
DTSTART:20260925T170000Z
DTEND:20260925T180000Z
SUMMARY:Reunião de time
END:VEVENT
BEGIN:VEVENT
UID:evt-456@outlook.com
DTSTAMP:20260920T120000Z
DTSTART;VALUE=DATE:20260926
DTEND;VALUE=DATE:20260927
SUMMARY:Feriado
END:VEVENT
END:VCALENDAR`;

describe('mapIcsToFacts', () => {
  it('mapeia VEVENTs com hora e de dia inteiro', () => {
    const facts = mapIcsToFacts(ICS);
    expect(facts).toHaveLength(2);

    expect(facts[0]).toMatchObject({ title: 'Reunião de time', source: 'outlook', sourceRef: 'evt-123@outlook.com', allDay: false });
    expect(facts[1]).toMatchObject({ title: 'Feriado', source: 'outlook', sourceRef: 'evt-456@outlook.com', allDay: true });
  });
});
