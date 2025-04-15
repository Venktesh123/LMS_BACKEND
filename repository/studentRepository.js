// Corrected repository/studentRepository.js
const {
  Student,
  User,
  Teacher,
  Course,
  Assignment,
  Submission,
  Enrollment,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

class StudentRepository {
  async create(studentData, options = {}) {
    return await Student.create(studentData, options);
  }

  async findById(id) {
    return await Student.findByPk(id, {
      include: [
        { model: User, as: "user" },
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, as: "user" }],
        },
      ],
    });
  }

  async findByUserId(userId) {
    return await Student.findOne({
      where: { userId },
      include: [
        { model: User, as: "user" },
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, as: "user" }],
        },
      ],
    });
  }

  async findByTeacherId(teacherId) {
    return await Student.findAll({
      where: { teacherId },
      include: [{ model: User, as: "user" }],
    });
  }

  async enrollInCourse(studentId, courseId) {
    try {
      const student = await Student.findByPk(studentId);
      const course = await Course.findByPk(courseId);

      if (!student || !course) {
        throw new Error("Student or course not found");
      }

      // First check if the enrollment already exists
      const existingEnrollment = await Enrollment.findOne({
        where: {
          studentId,
          courseId,
        },
      });

      if (existingEnrollment) {
        console.log(
          `Student ${studentId} is already enrolled in course ${courseId}`
        );
        return { student, course };
      }

      // Try direct model creation approach
      await Enrollment.create({
        id: uuidv4(),
        studentId: student.id,
        courseId: course.id,
        enrollmentDate: new Date(),
        status: "active",
      });

      return { student, course };
    } catch (error) {
      console.error("Error in enrollInCourse:", error);

      // Fallback to direct SQL if model approach fails
      try {
        await sequelize.query(
          `INSERT INTO "Enrollments" ("id", "studentId", "courseId", "enrollmentDate", "status", "createdAt", "updatedAt") 
           VALUES (:id, :studentId, :courseId, :enrollmentDate, :status, :createdAt, :updatedAt)`,
          {
            replacements: {
              id: uuidv4(),
              studentId,
              courseId,
              enrollmentDate: new Date(),
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            type: sequelize.QueryTypes.INSERT,
          }
        );
        console.log(
          `Enrolled student ${studentId} in course ${courseId} using direct SQL`
        );
        return { success: true };
      } catch (sqlError) {
        console.error("SQL enrollment error:", sqlError);
        throw error; // Throw the original error if SQL also fails
      }
    }
  }

  async getEnrolledCourses(studentId) {
    try {
      // Try to use the Enrollment model
      const enrollments = await Enrollment.findAll({
        where: { studentId },
        include: [{ model: Course, as: "course" }],
      });

      return enrollments.map((enrollment) => enrollment.course);
    } catch (error) {
      console.error("Error getting enrolled courses:", error);

      // Fallback to direct SQL if model approach fails
      const results = await sequelize.query(
        `SELECT c.* FROM "Courses" c 
         JOIN "Enrollments" e ON c."id" = e."courseId" 
         WHERE e."studentId" = :studentId`,
        {
          replacements: { studentId },
          type: sequelize.QueryTypes.SELECT,
        }
      );

      return results;
    }
  }

  async getSubmissions(studentId) {
    return await Submission.findAll({
      where: { studentId },
      include: [{ model: Assignment, as: "assignment" }],
    });
  }
}

module.exports = new StudentRepository();
