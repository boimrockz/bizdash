'use strict';

const { FOUNDATION } = require('./curriculum-foundation');
const { B0, B1 } = require('./curriculum-barista');
const { B2, B3 } = require('./curriculum-advanced');
const { HOS, BADGES, PATHS, RECIPES } = require('./curriculum-hospitality');
const { SUP, MGR, DIR, LEADERSHIP_BADGES, LEADERSHIP_PATHS } = require('./curriculum-leadership');

const TRACK_LABEL = {
  foundation: 'Foundation Program',
  barista: 'Barista Academy',
  hospitality: 'Hospitality & Service Excellence',
  kitchen: 'Kitchen Academy',
  leadership: 'Leadership Academy',
};

const TRACK_TONE = { foundation: 'indigo', barista: 'good', hospitality: 'warn', kitchen: 'muted', leadership: 'bad' };

const LEVEL_LABEL = {
  FND: 'Foundation',
  B0: 'B0 · Barista Trainee',
  B1: 'B1 · Barista Operator',
  B2: 'B2 · Senior Barista',
  B3: 'B3 · Barista Leader',
  HOS: 'Hospitality',
  SUP: 'S1 · Supervisor',
  MGR: 'M2 · Manajer Unit',
  DIR: 'E3 · Direktur & Chief',
};

/** Urutan level yang dipakai matriks kompetensi & pengelompokan katalog. */
const LEVELS = ['FND', 'B0', 'B1', 'B2', 'B3', 'HOS', 'SUP', 'MGR', 'DIR'];

const ALL_BADGES = BADGES.concat(LEADERSHIP_BADGES);
const ALL_PATHS = PATHS.concat(LEADERSHIP_PATHS);

const COURSES = [].concat(FOUNDATION, B0, B1, B2, B3, HOS, SUP, MGR, DIR).map((course, index) => ({
  ...course,
  sort_order: index + 1,
  version: course.version || '1.0',
  owner: course.owner || (course.track === 'hospitality' ? 'Training Coordinator'
    : course.track === 'leadership' ? 'Direktur Operasional' : 'Head Barista'),
  review_date: course.review_date || '2027-01-31',
}));

/** Dokumen pustaka otomatis dari SOP tiap modul + recipe master. */
function buildDocs() {
  const docs = [];
  for (const course of COURSES) {
    if (!course.sop) continue;
    docs.push({
      kind: 'sop',
      code: course.sop.code,
      title: course.sop.title,
      version: '1.0',
      status: 'published',
      owner: course.owner,
      summary: `Job aid untuk modul ${course.code} — ${course.title}`,
      body: (course.sop.points || []).map((p, i) => `${i + 1}) ${p}`).join('\n'),
      course_code: course.code,
    });
  }
  for (const recipe of RECIPES) {
    docs.push({
      kind: recipe.kind || 'recipe',
      code: recipe.code,
      title: recipe.title,
      version: recipe.version,
      status: 'published',
      owner: recipe.owner,
      summary: recipe.summary,
      body: recipe.body,
      course_code: 'BAR-206',
    });
  }
  return docs;
}

module.exports = {
  COURSES, PATHS: ALL_PATHS, BADGES: ALL_BADGES, RECIPES,
  TRACK_LABEL, TRACK_TONE, LEVEL_LABEL, LEVELS, buildDocs,
};
