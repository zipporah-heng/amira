import raw from "./data/amira_demo_evidence.json";
import type { AmiraFixture, Study } from "./types";

export const fixture = raw as unknown as AmiraFixture;

/** Everything the dashboard shows is derived from the studies array here, so
 *  numbers can never drift between the fixture and the UI. */
export interface DerivedStats {
  studyCount: number;
  femaleTotal: number;
  totalParticipants: number;
  femalePct: number;
  sexSpecificOutcomes: number;
  sexSpecificSafety: number;
  menopauseReported: number;
  hormoneTherapyReported: number;
  pregnancyReported: number;
  studyTypes: { type: string; count: number }[];
  notSexSpecific: number;
  notMenopause: number;
  notHormoneTherapy: number;
}

const yes = (v: string) => v === "yes";

export function derive(studies: Study[]): DerivedStats {
  const studyCount = studies.length;
  const femaleTotal = studies.reduce((a, s) => a + s.female_n, 0);
  const totalParticipants = studies.reduce((a, s) => a + s.total_n, 0);
  const femalePct = totalParticipants
    ? Math.round((femaleTotal / totalParticipants) * 100)
    : 0;

  const sexSpecificOutcomes = studies.filter((s) => yes(s.sex_specific_efficacy_reported)).length;
  const sexSpecificSafety = studies.filter((s) => yes(s.sex_specific_safety_reported)).length;
  const menopauseReported = studies.filter((s) => yes(s.menopause_reported)).length;
  const hormoneTherapyReported = studies.filter((s) => yes(s.hormone_therapy_reported)).length;
  const pregnancyReported = studies.filter((s) => yes(s.pregnancy_reported)).length;

  const typeMap = new Map<string, number>();
  for (const s of studies) typeMap.set(s.study_type, (typeMap.get(s.study_type) || 0) + 1);
  const order = ["Randomized Controlled Trial", "Observational Study", "Post-hoc Analysis", "Other"];
  const studyTypes = order
    .filter((t) => typeMap.has(t))
    .map((type) => ({ type, count: typeMap.get(type)! }));

  return {
    studyCount,
    femaleTotal,
    totalParticipants,
    femalePct,
    sexSpecificOutcomes,
    sexSpecificSafety,
    menopauseReported,
    hormoneTherapyReported,
    pregnancyReported,
    studyTypes,
    notSexSpecific: studyCount - sexSpecificOutcomes,
    notMenopause: studyCount - menopauseReported,
    notHormoneTherapy: studyCount - hormoneTherapyReported,
  };
}

export const stats = derive(fixture.studies);
