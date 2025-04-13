const { Student, User, Course, Teacher, sequelize } = require("../models");

// Enroll in a course
const enrollCourse = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find student profile
    const student = await Student.findOne({
      where: { userId },
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ error: "Student not found" });
    }

    // Find the course
    const course = await Course.findByPk(courseId, {
      transaction,
    });

    if (!course) {
      await transaction.rollback();
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if the student's teacher matches the course's teacher
    if (student.teacherId !== course.teacherId) {
      await transaction.rollback();
      return res.status(403).json({
        error: "You can only enroll in courses taught by your assigned teacher",
      });
    }

    // Check if student is already enrolled
    const existingEnrollment = await sequelize.models.Enrollment.findOne({
      where: {
        studentId: student.id,
        courseId: course.id,
      },
      transaction,
    });

    if (existingEnrollment) {
      await transaction.rollback();
      return res.status(400).json({ error: "Already enrolled in this course" });
    }

    // Create enrollment
    await sequelize.models.Enrollment.create(
      {
        studentId: student.id,
        courseId: course.id,
      },
      { transaction }
    );

    await transaction.commit();

    // Get course details for response
    const enrolledCourse = await Course.findByPk(course.id, {
      include: [
        {
          model: Teacher,
          include: [{ model: User, attributes: ["name", "email"] }],
        },
        { model: sequelize.models.Semester },
      ],
    });

    return res.status(200).json({
      message: "Successfully enrolled in the course",
      course: {
        id: enrolledCourse.id,
        title: enrolledCourse.title,
        aboutCourse: enrolledCourse.aboutCourse,
        teacher: enrolledCourse.Teacher
          ? {
              name: enrolledCourse.Teacher.User
                ? enrolledCourse.Teacher.User.name
                : null,
              email: enrolledCourse.Teacher.User
                ? enrolledCourse.Teacher.User.email
                : null,
            }
          : null,
        semester: enrolledCourse.Semester
          ? {
              name: enrolledCourse.Semester.name,
              startDate: enrolledCourse.Semester.startDate,
              endDate: enrolledCourse.Semester.endDate,
            }
          : null,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in enrollCourse:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Unenroll from a course
const unenrollCourse = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find student profile
    const student = await Student.findOne({
      where: { userId },
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ error: "Student not found" });
    }

    // Check if student is enrolled in this course
    const enrollment = await sequelize.models.Enrollment.findOne({
      where: {
        studentId: student.id,
        courseId,
      },
      transaction,
    });

    if (!enrollment) {
      await transaction.rollback();
      return res.status(400).json({ error: "Not enrolled in this course" });
    }

    // Delete enrollment
    await enrollment.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      message: "Successfully unenrolled from the course",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in unenrollCourse:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get student profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find student with relations
    const student = await Student.findOne({
      where: { userId },
      include: [
        { model: User, attributes: ["name", "email"] },
        {
          model: Teacher,
          attributes: ["id", "email"],
          include: [{ model: User, attributes: ["name", "email"] }],
        },
      ],
    });

    if (!student) {
      return res.status(404).json({ error: "Student profile not found" });
    }

    // Get enrolled courses count
    const enrollmentCount = await sequelize.models.Enrollment.count({
      where: { studentId: student.id },
    });

    // Format the response
    const profile = {
      id: student.id,
      name: student.User.name,
      email: student.User.email,
      program: student.program,
      semester: student.semester,
      teacher: student.Teacher
        ? {
            id: student.Teacher.id,
            name: student.Teacher.User ? student.Teacher.User.name : null,
            email: student.Teacher.email,
          }
        : null,
      coursesEnrolled: enrollmentCount,
    };

    return res.json(profile);
  } catch (error) {
    console.error("Error in getProfile:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Update student profile
const updateProfile = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { program, semester } = req.body;

    // Find student
    const student = await Student.findOne({
      where: { userId },
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ error: "Student profile not found" });
    }

    // Update fields
    if (program) student.program = program;
    if (semester) student.semester = semester;

    await student.save({ transaction });

    await transaction.commit();

    return res.json({
      message: "Profile updated successfully",
      student: {
        id: student.id,
        program: student.program,
        semester: student.semester,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateProfile:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  enrollCourse,
  unenrollCourse,
  getProfile,
  updateProfile,
};
