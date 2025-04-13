const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Get user courses
router.get("/", auth, courseController.getUserCourses);

// Get enrolled courses (for student)
router.get(
  "/enrolled",
  auth,
  checkRole(["student"]),
  courseController.getEnrolledCourses
);

// Get specific course by ID
router.get("/:courseId", auth, courseController.getCourseById);

// Create new course (teacher only)
router.post("/", auth, checkRole(["teacher"]), courseController.createCourse);

// Update course (teacher only)
router.put(
  "/:courseId",
  auth,
  checkRole(["teacher"]),
  courseController.updateCourse
);

// Delete course (teacher only)
router.delete(
  "/:courseId",
  auth,
  checkRole(["teacher"]),
  courseController.deleteCourse
);

module.exports = router;
