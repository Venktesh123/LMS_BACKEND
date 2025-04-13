const {
  Course,
  User,
  Teacher,
  Student,
  Semester,
  Lecture,
  Assignment,
  sequelize,
} = require("../models");
const { uploadFileToS3 } = require("../utils/s3Helper");

// Get courses for currently authenticated user
const getUserCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === "teacher") {
      // Get courses where user is a teacher
      const teacher = await Teacher.findOne({
        where: { userId },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (!teacher) {
        return res.status(404).json({ error: "Teacher profile not found" });
      }

      // Count students under this teacher
      const studentCount = await Student.count({
        where: { teacherId: teacher.id },
      });

      // Get all courses taught by this teacher
      const courses = await Course.findAll({
        where: { teacherId: teacher.id },
        attributes: ["id", "title", "aboutCourse"],
        include: [
          {
            model: Semester,
            attributes: ["id", "name", "startDate", "endDate"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      return res.json({
        user: {
          id: teacher.id,
          name: teacher.User.name,
          email: teacher.User.email,
          role: "teacher",
          totalStudents: studentCount,
          totalCourses: courses.length || 0,
        },
        courses: courses.map((course) => ({
          id: course.id,
          title: course.title,
          aboutCourse: course.aboutCourse,
          semester: course.Semester
            ? {
                id: course.Semester.id,
                name: course.Semester.name,
                startDate: course.Semester.startDate,
                endDate: course.Semester.endDate,
              }
            : null,
        })),
      });
    } else if (userRole === "student") {
      // Get courses where user is enrolled as a student
      const student = await Student.findOne({
        where: { userId },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (!student) {
        return res.status(404).json({ error: "Student profile not found" });
      }

      // Get all enrollments for this student
      const enrollments = await sequelize.models.Enrollment.findAll({
        where: { studentId: student.id },
        include: [
          {
            model: Course,
            attributes: ["id", "title", "aboutCourse"],
            include: [
              {
                model: Semester,
                attributes: ["id", "name", "startDate", "endDate"],
              },
            ],
          },
        ],
      });

      const courses = enrollments.map((enrollment) => enrollment.Course);

      return res.json({
        user: {
          id: student.id,
          name: student.User.name,
          email: student.User.email,
          role: "student",
          totalCourses: courses.length || 0,
        },
        courses: courses.map((course) => ({
          id: course.id,
          title: course.title,
          aboutCourse: course.aboutCourse,
          semester: course.Semester
            ? {
                id: course.Semester.id,
                name: course.Semester.name,
                startDate: course.Semester.startDate,
                endDate: course.Semester.endDate,
              }
            : null,
        })),
      });
    } else {
      return res.status(403).json({ error: "Invalid user role" });
    }
  } catch (error) {
    console.error("Error in getUserCourses:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get enrolled courses for a student
const getEnrolledCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    // Ensure user is a student
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ error: "Access denied. Student role required" });
    }

    // Find student profile
    const student = await Student.findOne({
      where: { userId },
      include: [{ model: User, attributes: ["name", "email", "role"] }],
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get all enrollments for this student
    const enrollments = await sequelize.models.Enrollment.findAll({
      where: { studentId: student.id },
      include: [
        {
          model: Course,
          attributes: ["id", "title", "aboutCourse"],
          include: [
            {
              model: Semester,
              attributes: ["id", "name", "startDate", "endDate"],
            },
          ],
        },
      ],
    });

    const courses = enrollments.map((enrollment) => enrollment.Course);

    if (courses.length === 0) {
      return res.json({
        user: {
          id: student.id,
          name: student.User.name,
          email: student.User.email,
          role: "student",
          totalCourses: 0,
        },
        courses: [],
      });
    }

    return res.json({
      user: {
        id: student.id,
        name: student.User.name,
        email: student.User.email,
        role: "student",
        totalCourses: courses.length,
      },
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        aboutCourse: course.aboutCourse,
        semester: course.Semester
          ? {
              id: course.Semester.id,
              name: course.Semester.name,
              startDate: course.Semester.startDate,
              endDate: course.Semester.endDate,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error in getEnrolledCourses:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get specific course by ID
const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the course with its relationships
    const course = await Course.findByPk(courseId, {
      include: [{ model: Semester }, { model: Teacher }],
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if user has access to this course
    let hasAccess = false;
    let userDetails = null;
    let students = [];

    if (userRole === "teacher") {
      // For teacher: check if they're the course teacher
      const teacher = await Teacher.findOne({
        where: { userId, id: course.teacherId },
        include: [{ model: User, attributes: ["name", "email", "role"] }],
      });

      if (teacher) {
        hasAccess = true;
        userDetails = {
          id: teacher.id,
          name: teacher.User.name,
          email: teacher.User.email,
        };

        // Get students enrolled in this course
        const enrollments = await sequelize.models.Enrollment.findAll({
          where: { courseId },
          include: [
            {
              model: Student,
              include: [{ model: User, attributes: ["name", "email"] }],
            },
          ],
        });

        students = enrollments.map((enrollment, index) => ({
          id: enrollment.Student.id,
          rollNo: `CS${String(index + 101).padStart(3, "0")}`,
          name: enrollment.Student.User.name || "Unknown",
          program: enrollment.Student.program || "Computer Science",
          email: enrollment.Student.User.email || "",
        }));
      }
    } else if (userRole === "student") {
      // For student: check if they're enrolled in the course
      const student = await Student.findOne({
        where: { userId },
        include: [{ model: User, attributes: ["name", "email", "role"] }],
      });

      if (student) {
        // Check if student is enrolled in this course
        const enrollment = await sequelize.models.Enrollment.findOne({
          where: {
            studentId: student.id,
            courseId: course.id,
          },
        });

        if (enrollment) {
          hasAccess = true;
          userDetails = {
            id: student.id,
            name: student.User.name,
            email: student.User.email,
          };

          // Get teacher info for this course
          const courseTeacher = await Teacher.findByPk(course.teacherId, {
            include: [{ model: User, attributes: ["name", "email"] }],
          });

          if (courseTeacher) {
            userDetails.teacher = {
              id: courseTeacher.id,
              name: courseTeacher.User.name,
              email: courseTeacher.User.email,
            };
          }
        }
      }
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "You don't have access to this course" });
    }

    // Get lectures, assignments, and other course details
    const lectures = await Lecture.findAll({
      where: { courseId: course.id },
      order: [["createdAt", "ASC"]],
    });

    const assignments = await Assignment.findAll({
      where: { courseId: course.id },
      order: [["dueDate", "ASC"]],
    });

    // Format the course data
    const courseData = {
      id: course.id,
      title: course.title,
      aboutCourse: course.aboutCourse,
      semester: course.Semester
        ? {
            id: course.Semester.id,
            name: course.Semester.name,
            startDate: course.Semester.startDate,
            endDate: course.Semester.endDate,
          }
        : null,
      lectures: lectures.map((lecture) => ({
        id: lecture.id,
        title: lecture.title,
        isReviewed: lecture.isReviewed,
        reviewDeadline: lecture.reviewDeadline,
        createdAt: lecture.createdAt,
      })),
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        dueDate: assignment.dueDate,
        totalPoints: assignment.totalPoints,
        isActive: assignment.isActive,
      })),
    };

    // Add role-specific data
    if (userRole === "teacher") {
      courseData.teacher = userDetails;
      courseData.students = students;
    } else if (userRole === "student") {
      courseData.student = userDetails;
    }

    return res.json(courseData);
  } catch (error) {
    console.error("Error in getCourseById:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Create a new course
const createCourse = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { title, aboutCourse, semesterId } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    // Find the semester
    const semester = await Semester.findByPk(semesterId, { transaction });
    if (!semester) {
      await transaction.rollback();
      return res.status(404).json({ error: "Semester not found" });
    }

    // Create the course
    const course = await Course.create(
      {
        title,
        aboutCourse,
        semesterId,
        teacherId: teacher.id,
      },
      { transaction }
    );

    // If lectures are provided in the request, create them
    if (req.body.lectures && Array.isArray(req.body.lectures)) {
      const lecturePromises = req.body.lectures.map((lectureData) => {
        return Lecture.create(
          {
            title: lectureData.title,
            content: lectureData.content || lectureData.title,
            videoUrl: lectureData.videoUrl || null,
            courseId: course.id,
          },
          { transaction }
        );
      });

      await Promise.all(lecturePromises);
    }

    // Get students assigned to this teacher and enroll them in the course
    const students = await Student.findAll({
      where: { teacherId: teacher.id },
      transaction,
    });

    if (students.length > 0) {
      const enrollmentPromises = students.map((student) => {
        return sequelize.models.Enrollment.create(
          {
            studentId: student.id,
            courseId: course.id,
          },
          { transaction }
        );
      });

      await Promise.all(enrollmentPromises);
    }

    await transaction.commit();

    // Return the created course with its relationships
    const createdCourse = await Course.findByPk(course.id, {
      include: [{ model: Semester }, { model: Lecture, as: "lectures" }],
    });

    return res.status(201).json({
      success: true,
      course: createdCourse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in createCourse:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Update a course
const updateCourse = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const { title, aboutCourse, semesterId } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    // Find the course and check ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "Course not found or unauthorized" });
    }

    // Update course fields
    if (title) course.title = title;
    if (aboutCourse) course.aboutCourse = aboutCourse;

    // Update semester if provided and exists
    if (semesterId) {
      const semester = await Semester.findByPk(semesterId, { transaction });
      if (!semester) {
        await transaction.rollback();
        return res.status(404).json({ error: "Semester not found" });
      }
      course.semesterId = semesterId;
    }

    await course.save({ transaction });
    await transaction.commit();

    // Return the updated course with its relationships
    const updatedCourse = await Course.findByPk(course.id, {
      include: [{ model: Semester }, { model: Lecture, as: "lectures" }],
    });

    return res.json({
      success: true,
      course: updatedCourse,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateCourse:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Delete a course
const deleteCourse = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    // Find the course and check ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ error: "Course not found or unauthorized" });
    }

    // Delete all enrollments
    await sequelize.models.Enrollment.destroy({
      where: { courseId },
      transaction,
    });

    // Delete all lectures
    await Lecture.destroy({
      where: { courseId },
      transaction,
    });

    // Delete all assignments and their submissions
    const assignments = await Assignment.findAll({
      where: { courseId },
      transaction,
    });

    for (const assignment of assignments) {
      await sequelize.models.Submission.destroy({
        where: { assignmentId: assignment.id },
        transaction,
      });
    }

    await Assignment.destroy({
      where: { courseId },
      transaction,
    });

    // Finally delete the course
    await course.destroy({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in deleteCourse:", error);
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getUserCourses,
  getEnrolledCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
};
