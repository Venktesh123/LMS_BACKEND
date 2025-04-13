const { Teacher, Student, User, Course, sequelize } = require("../models");

// Get all students assigned to the teacher
const getStudents = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    // Get students assigned to this teacher
    const students = await Student.findAll({
      where: { teacherId: teacher.id },
      include: [{ model: User, attributes: ["name", "email"] }],
      order: [[User, "name", "ASC"]],
    });

    // Format the response
    const formattedStudents = await Promise.all(
      students.map(async (student) => {
        // Count enrolled courses for each student
        const enrollmentCount = await sequelize.models.Enrollment.count({
          where: { studentId: student.id },
        });

        return {
          id: student.id,
          name: student.User.name,
          email: student.User.email,
          program: student.program,
          semester: student.semester,
          enrolledCourses: enrollmentCount,
        };
      })
    );

    return res.json({
      teacher: {
        id: teacher.id,
        name: teacher.User.name,
        email: teacher.email,
      },
      studentCount: formattedStudents.length,
      students: formattedStudents,
    });
  } catch (error) {
    console.error("Error in getStudents:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Assign a student to this teacher
const assignStudent = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { studentId } = req.params;
    const userId = req.user.id;

    // Find teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    // Find student
    const student = await Student.findByPk(studentId, {
      include: [{ model: User, attributes: ["name", "email", "role"] }],
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ error: "Student not found" });
    }

    if (student.User.role !== "student") {
      await transaction.rollback();
      return res.status(400).json({ error: "User is not a student" });
    }

    // Update student's teacher
    student.teacherId = teacher.id;
    student.teacherEmail = teacher.email;
    await student.save({ transaction });

    // Enroll student in all courses taught by this teacher
    const teacherCourses = await Course.findAll({
      where: { teacherId: teacher.id },
      transaction,
    });

    if (teacherCourses.length > 0) {
      const enrollmentPromises = teacherCourses.map((course) => {
        return sequelize.models.Enrollment.findOrCreate({
          where: {
            studentId: student.id,
            courseId: course.id,
          },
          transaction,
        });
      });

      await Promise.all(enrollmentPromises);
    }

    await transaction.commit();

    return res.json({
      message: "Student assigned successfully",
      student: {
        id: student.id,
        name: student.User.name,
        email: student.User.email,
        coursesEnrolled: teacherCourses.length,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in assignStudent:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get teacher profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find teacher with relations
    const teacher = await Teacher.findOne({
      where: { userId },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    // Count students and courses
    const studentCount = await Student.count({
      where: { teacherId: teacher.id },
    });

    const courseCount = await Course.count({
      where: { teacherId: teacher.id },
    });

    // Format the response
    const profile = {
      id: teacher.id,
      name: teacher.User.name,
      email: teacher.email,
      studentCount,
      courseCount,
    };

    return res.json(profile);
  } catch (error) {
    console.error("Error in getProfile:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get students with detailed enrollment information
const getStudentsWithEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    // Get all students assigned to this teacher
    const students = await Student.findAll({
      where: { teacherId: teacher.id },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    // Get all courses taught by this teacher
    const courses = await Course.findAll({
      where: { teacherId: teacher.id },
      attributes: ["id", "title"],
    });

    // Get all enrollments for these students
    const enrollments = await sequelize.models.Enrollment.findAll({
      where: {
        studentId: students.map((student) => student.id),
        courseId: courses.map((course) => course.id),
      },
    });

    // Create a map of courseId -> course
    const courseMap = courses.reduce((map, course) => {
      map[course.id] = course;
      return map;
    }, {});

    // Format the response
    const formattedStudents = students.map((student) => {
      // Find all enrollments for this student
      const studentEnrollments = enrollments.filter(
        (enrollment) => enrollment.studentId === student.id
      );

      // Map enrollments to course information
      const enrolledCourses = studentEnrollments.map((enrollment) => ({
        id: enrollment.courseId,
        title: courseMap[enrollment.courseId]?.title || "Unknown Course",
        enrolledAt: enrollment.createdAt,
      }));

      return {
        id: student.id,
        name: student.User.name,
        email: student.User.email,
        program: student.program,
        semester: student.semester,
        enrolledCourses,
      };
    });

    return res.json({
      teacher: {
        id: teacher.id,
        name: teacher.User.name,
        email: teacher.email,
      },
      studentCount: formattedStudents.length,
      courseCount: courses.length,
      students: formattedStudents,
    });
  } catch (error) {
    console.error("Error in getStudentsWithEnrollments:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getStudents,
  assignStudent,
  getProfile,
  getStudentsWithEnrollments,
};
