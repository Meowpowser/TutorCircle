/**
 * SurveyService — the Student Needs Survey.
 *
 * Fairness: matching uses ONLY the course from the survey, so every student
 * with the same needs is shown the same groups (no hidden ranking).
 */
import { Events } from '../core/EventBus.js';
import { rules, validate } from './validation.js';

export const CONFIDENCE_LEVELS = ['Low', 'Medium', 'High'];
export const NEED_OPTIONS = ['Understanding concepts', 'Assignment help', 'Exam preparation', 'Practice problems'];

export class SurveyService {
  constructor(repos, permissions, groupService, bus) {
    this.repos = repos;
    this.permissions = permissions;
    this.groups = groupService;
    this.bus = bus;
  }

  latest(studentId) {
    return this.repos.surveys.findLatestForStudent(studentId);
  }

  submit(student, { courseCode, confidence, needs }) {
    this.permissions.requireRole(student, 'student');
    validate({ courseCode, confidence, needs }, {
      courseCode: [rules.required('Course'), (v) => (this.repos.courses.findByCode(v) ? '' : 'Choose a course from the list.')],
      confidence: [rules.oneOf('Confidence level', CONFIDENCE_LEVELS)],
      needs: [rules.nonEmptyList('Select at least one thing you need help with.')],
    });
    const survey = this.repos.surveys.insert({
      studentId: student.id,
      courseCode,
      confidence,
      needs: needs.filter((n) => NEED_OPTIONS.includes(n)),
      submittedAt: new Date().toISOString(),
    });
    this.bus.publish(Events.SURVEYS, { surveyId: survey.id });
    return survey;
  }

  /** Groups for the surveyed course that the student can still join. */
  recommendedGroups(student, survey) {
    if (!survey) return [];
    return this.groups.findGroups({ course: survey.courseCode }, student.id);
  }
}
