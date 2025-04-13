const { Assignment, Course, Student, Submission } = require("../models");
const { Op } = require("sequelize");

class AssignmentRepository {
  async create(assignmentData) {
    return await Assignment.create(assignmentData);
  }

  async findById(id) {
    return await Assignment.findByPk(id, {
      include: [{ model: Course, as: "course" }],
    });
  }

  async findByCourseId(courseId) {
    return await Assignment.findAll({
      where: { courseId },
      order: [["dueDate", "ASC"]],
    });
  }

  async update(id, assignmentData) {
    const assignment = await Assignment.findByPk(id);

    if (!assignment) {
      return null;
    }

    return await assignment.update(assignmentData);
  }

  async delete(id) {
    const assignment = await Assignment.findByPk(id);

    if (!assignment) {
      return false;
    }

    await assignment.destroy();
    return true;
  }

  async createSubmission(submissionData) {
    return await Submission.create(submissionData);
  }

  async findSubmissionById(id) {
    return await Submission.findByPk(id, {
      include: [
        { model: Assignment, as: "assignment" },
        {
          model: Student,
          as: "student",
          include: [{ model: User, as: "user" }],
        },
      ],
    });
  }

  async updateSubmission(id, submissionData) {
    const submission = await Submission.findByPk(id);

    if (!submission) {
      return null;
    }

    return await submission.update(submissionData);
  }

  async getSubmissionsByAssignment(assignmentId) {
    return await Submission.findAll({
      where: { assignmentId },
      include: [
        {
          model: Student,
          as: "student",
          include: [{ model: User, as: "user" }],
        },
      ],
    });
  }

  async getSubmissionsByStudent(studentId) {
    return await Submission.findAll({
      where: { studentId },
      include: [{ model: Assignment, as: "assignment" }],
    });
  }
}

module.exports = new AssignmentRepository();
